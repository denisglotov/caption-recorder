import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DraftStorageService } from '../src/services/DraftStorageService';
import type { MeetingSession } from '../src/core/types';

describe('DraftStorageService', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = {};

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete mockStorage[key];
          }),
        },
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    vi.restoreAllMocks();
  });

  function createTestSession(): MeetingSession {
    return {
      id: 'test_session_123',
      title: 'Sprint Planning',
      startTime: 1000000,
      platform: 'google-meet',
      segments: [
        {
          id: 'seg_1',
          speaker: 'Denis',
          startTime: 1000050,
          endTime: 1000060,
          text: 'Welcome everyone',
        },
      ],
      url: 'https://meet.google.com/abc-defg-hij',
    };
  }

  it('saves draft immediately with savedAt timestamp', async () => {
    const session = createTestSession();
    await DraftStorageService.saveDraftImmediate(session);

    const saved = mockStorage['caption_recorder_unsaved_draft'] as MeetingSession & {
      savedAt: number;
    };
    expect(saved).toBeDefined();
    expect(saved.id).toBe('test_session_123');
    expect(saved.segments.length).toBe(1);
    expect(saved.segments[0].text).toBe('Welcome everyone');
    expect(saved.url).toBe('https://meet.google.com/abc-defg-hij');
    expect(typeof saved.savedAt).toBe('number');
  });

  it('debounces successive draft saves and writes only after delay', async () => {
    const session = createTestSession();

    DraftStorageService.saveDraftDebounced(session, 500);
    expect(mockStorage['caption_recorder_unsaved_draft']).toBeUndefined();

    // Advance 200ms - still not written
    vi.advanceTimersByTime(200);
    expect(mockStorage['caption_recorder_unsaved_draft']).toBeUndefined();

    // Advance remaining 300ms - now written
    vi.advanceTimersByTime(300);
    expect(mockStorage['caption_recorder_unsaved_draft']).toBeDefined();
  });

  it('cancels pending debounced save when saveDraftImmediate is called', async () => {
    const session1 = createTestSession();
    session1.title = 'Old Title';

    DraftStorageService.saveDraftDebounced(session1, 500);

    const session2 = createTestSession();
    session2.title = 'Immediate New Title';
    await DraftStorageService.saveDraftImmediate(session2);

    expect((mockStorage['caption_recorder_unsaved_draft'] as MeetingSession).title).toBe(
      'Immediate New Title'
    );

    // Advance time past the original 500ms debounce
    vi.advanceTimersByTime(600);

    // Should still be session2 title and not overwritten by session1
    expect((mockStorage['caption_recorder_unsaved_draft'] as MeetingSession).title).toBe(
      'Immediate New Title'
    );
  });

  it('retrieves unsaved draft when valid segments exist', async () => {
    const session = createTestSession();
    await DraftStorageService.saveDraftImmediate(session);

    const retrieved = await DraftStorageService.getUnsavedDraft();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test_session_123');
    expect(retrieved?.segments.length).toBe(1);
  });

  it('returns null if draft has empty segments or does not exist', async () => {
    expect(await DraftStorageService.getUnsavedDraft()).toBeNull();

    const emptySession = createTestSession();
    emptySession.segments = [];
    await DraftStorageService.saveDraftImmediate(emptySession);

    expect(await DraftStorageService.getUnsavedDraft()).toBeNull();
  });

  it('clears draft from storage', async () => {
    const session = createTestSession();
    await DraftStorageService.saveDraftImmediate(session);
    expect(await DraftStorageService.getUnsavedDraft()).not.toBeNull();

    await DraftStorageService.clearDraft();
    expect(await DraftStorageService.getUnsavedDraft()).toBeNull();
    expect(mockStorage['caption_recorder_unsaved_draft']).toBeUndefined();
  });

  it('handles extension context invalidation gracefully without throwing or logging error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 1. Simulating chrome.runtime.id becoming undefined (orphaned content script)
    (globalThis as unknown as { chrome: { runtime?: { id?: string } } }).chrome.runtime = {};
    expect(DraftStorageService.isContextValid()).toBe(false);

    const session = createTestSession();
    await expect(DraftStorageService.saveDraftImmediate(session)).resolves.not.toThrow();
    await expect(DraftStorageService.getUnsavedDraft()).resolves.toBeNull();
    await expect(DraftStorageService.clearDraft()).resolves.not.toThrow();

    // 2. Simulating chrome API throwing "Extension context invalidated"
    (
      globalThis as unknown as {
        chrome: { runtime?: { id?: string }; storage: { local: { set: unknown } } };
      }
    ).chrome.runtime = { id: 'test_id' };
    (
      globalThis as unknown as { chrome: { storage: { local: { set: unknown } } } }
    ).chrome.storage.local.set = vi
      .fn()
      .mockRejectedValue(new Error('Extension context invalidated.'));

    await expect(DraftStorageService.saveDraftImmediate(session)).resolves.not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
