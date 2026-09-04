import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionRecorder } from '../src/core/SessionRecorder';
import { DraftStorageService } from '../src/services/DraftStorageService';
import type { PlatformAdapter } from '../src/adapters/PlatformAdapter';
import type { InterimCaption, MeetingSession } from '../src/core/types';

describe('SessionRecorder Headless Coordinator', () => {
  let mockStorage: Record<string, unknown> = {};
  let windowListeners: Record<string, ((e?: unknown) => void)[]> = {};
  let runtimeListeners: ((
    message: unknown,
    sender: unknown,
    sendResponse: (r?: unknown) => void
  ) => void)[] = [];
  let storageListeners: ((changes: Record<string, unknown>, areaName: string) => void)[] = [];
  let sentMessages: unknown[] = [];
  let mockAdapter: PlatformAdapter;

  beforeEach(() => {
    mockStorage = {};
    windowListeners = {};
    runtimeListeners = [];
    storageListeners = [];
    sentMessages = [];

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
        onChanged: {
          addListener: (cb: (changes: Record<string, unknown>, areaName: string) => void) => {
            storageListeners.push(cb);
          },
          removeListener: vi.fn(),
        },
      },
      runtime: {
        id: 'test_ext_id',
        sendMessage: vi.fn(async (msg: unknown) => {
          sentMessages.push(msg);
          return { success: true };
        }),
        onMessage: {
          addListener: (cb: (m: unknown, s: unknown, res: (r?: unknown) => void) => void) => {
            runtimeListeners.push(cb);
          },
          removeListener: vi.fn(),
        },
      },
      i18n: {
        getUILanguage: () => 'en',
      },
    };

    (globalThis as unknown as { window: unknown }).window = {
      location: { href: 'https://meet.google.com/abc-defg-hij', pathname: '/abc-defg-hij' },
      addEventListener: (event: string, cb: (e?: unknown) => void) => {
        windowListeners[event] = windowListeners[event] || [];
        windowListeners[event].push(cb);
      },
      removeEventListener: vi.fn(),
      confirm: vi.fn(() => true),
    };

    (globalThis as unknown as { document: unknown }).document = {
      title: 'Google Meet',
    };

    mockAdapter = {
      name: 'Google Meet',
      platformId: 'google-meet',
      matchesUrl: () => true,
      isCaptionsEnabled: () => true,
      observe: vi.fn(),
      stop: vi.fn(),
      flush: vi.fn(),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
    vi.restoreAllMocks();
  });

  function createSavedMeetingDraft(): MeetingSession {
    return {
      id: 'session_saved_123',
      title: 'Standup Meeting',
      startTime: 1000000,
      endTime: 1060000,
      platform: 'google-meet',
      url: 'https://meet.google.com/abc-defg-hij',
      segments: [
        {
          id: 'seg_1',
          speaker: 'Denis',
          startTime: 1000010,
          endTime: 1000030,
          text: 'First discussion point spoken in meeting.',
        },
        {
          id: 'seg_2',
          speaker: 'Alice',
          startTime: 1000035,
          endTime: 1000055,
          text: 'Second point in discussion.',
        },
      ],
    };
  }

  it('restores draft session segments on initialization', async () => {
    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    const session = recorder.getSession();
    expect(session.id).toBe('session_saved_123');
    expect(session.segments.length).toBe(2);
    expect(session.segments[0].speaker).toBe('Denis');
    expect(session.segments[1].speaker).toBe('Alice');
    recorder.destroy();
  });

  it('flushes pending captions and saves draft immediately on window beforeunload or pagehide', async () => {
    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    const session = recorder.getSession();
    session.segments.push({
      id: 'seg_unload',
      speaker: 'You',
      startTime: 2000,
      endTime: 3000,
      text: 'Final words before leaving call',
    });

    expect(windowListeners['beforeunload']?.length).toBeGreaterThan(0);
    windowListeners['beforeunload'][0]();

    expect(mockAdapter.flush).toHaveBeenCalled();

    const storedDraft = await DraftStorageService.getUnsavedDraft();
    expect(storedDraft).not.toBeNull();
    expect(storedDraft?.segments.some((s) => s.id === 'seg_unload')).toBe(true);
    recorder.destroy();
  });

  it('resets session and clears storage when resetSession is executed', async () => {
    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    await recorder.resetSession(true);

    const storedDraft = await DraftStorageService.getUnsavedDraft();
    expect(storedDraft).toBeNull();

    const session = recorder.getSession();
    expect(session.segments.length).toBe(0);
    expect(session.id).not.toBe('session_saved_123');
    recorder.destroy();
  });

  it('appends new caption turns to active session without clobbering', async () => {
    let onFinalizedCb: ((caption: InterimCaption) => void) | undefined;
    mockAdapter.observe = vi.fn((onFinalized) => {
      onFinalizedCb = onFinalized;
    });

    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    expect(onFinalizedCb).toBeDefined();
    await onFinalizedCb!({
      speaker: 'Bob',
      text: 'Third speaker joins the discussion.',
      timestamp: 1000070,
      startTime: 1000060,
    });

    const session = recorder.getSession();
    expect(session.segments.length).toBe(3);
    expect(session.segments[2].speaker).toBe('Bob');
    expect(session.segments[2].text).toBe('Third speaker joins the discussion.');

    // Message sent to side panel
    expect(sentMessages.some((m) => (m as { type?: string }).type === 'CR_NEW_TURN')).toBe(true);
    recorder.destroy();
  });

  it('resets recorder session when draft is cleared from storage while paused', async () => {
    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    // Simulate clearing storage
    storageListeners.forEach((cb) =>
      cb(
        {
          caption_recorder_unsaved_draft: {
            oldValue: draft,
            newValue: null,
          },
        },
        'local'
      )
    );

    const session = recorder.getSession();
    expect(session.segments.length).toBe(0);
    expect(session.id).not.toBe('session_saved_123');
    recorder.destroy();
  });

  it('handles captions enable and disable state transitions', async () => {
    let onStateChangeCb: ((enabled: boolean) => void) | undefined;
    mockAdapter.observe = vi.fn((_onFinalized, onStateChange) => {
      onStateChangeCb = onStateChange;
    });

    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    expect(onStateChangeCb).toBeDefined();

    // Disable captions
    onStateChangeCb!(false);
    expect(recorder.getStatus()).toBe('paused');
    expect(
      sentMessages.some((m) => (m as { type?: string; status?: string }).status === 'paused')
    ).toBe(true);

    // Enable captions
    onStateChangeCb!(true);
    expect(recorder.getStatus()).toBe('recording');
    expect(
      sentMessages.some((m) => (m as { type?: string; status?: string }).status === 'recording')
    ).toBe(true);
    recorder.destroy();
  });

  it('responds to CR_GET_STATUS and CR_RESET_SESSION messages', async () => {
    const recorder = new SessionRecorder(mockAdapter);
    await recorder.restorePromise;

    expect(runtimeListeners.length).toBeGreaterThan(0);

    const statusHandler = runtimeListeners[0];
    let responseData: unknown;
    statusHandler({ type: 'CR_GET_STATUS' }, {}, (res) => {
      responseData = res;
    });

    expect(responseData).toBeDefined();
    expect((responseData as { session: MeetingSession }).session.id).toBe(recorder.getSession().id);

    let resetResponse: unknown;
    statusHandler({ type: 'CR_RESET_SESSION' }, {}, (res) => {
      resetResponse = res;
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(resetResponse).toEqual({ success: true });
    recorder.destroy();
  });
});
