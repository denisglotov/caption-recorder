import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaptionOverlay } from '../src/ui/CaptionOverlay';
import { DraftStorageService } from '../src/services/DraftStorageService';
import type { PlatformAdapter } from '../src/adapters/PlatformAdapter';
import type { InterimCaption, MeetingSession } from '../src/core/types';

// Minimal mock element for Shadow DOM testing in node
interface MockElement {
  tagName: string;
  id: string;
  className: string;
  classList: {
    add: (cls: string) => void;
    remove: (cls: string) => void;
    toggle: (cls: string, force?: boolean) => void;
    contains: (cls: string) => boolean;
  };
  style: Record<string, string>;
  textContent: string;
  innerHTML: string;
  value?: string;
  disabled?: boolean;
  title?: string;
  listeners: Record<string, ((e?: unknown) => void)[]>;
  addEventListener: (event: string, cb: (e?: unknown) => void) => void;
  removeEventListener: (event: string, cb: (e?: unknown) => void) => void;
  querySelector: (sel: string) => MockElement | null;
  querySelectorAll: (sel: string) => MockElement[];
  getAttribute: (attr: string) => string | null;
  setAttribute: (attr: string, val: string) => void;
  closest: (sel: string) => MockElement | null;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
}

function createMockElement(tagName: string = 'div', id: string = ''): MockElement {
  const classes = new Set<string>();
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  const attrs: Record<string, string> = {};

  const el: MockElement = {
    tagName: tagName.toUpperCase(),
    id,
    get className() {
      return Array.from(classes).join(' ');
    },
    set className(val: string) {
      classes.clear();
      val
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => classes.add(c));
    },
    classList: {
      add: (cls: string) => classes.add(cls),
      remove: (cls: string) => classes.delete(cls),
      toggle: (cls: string, force?: boolean) => {
        if (force === true) classes.add(cls);
        else if (force === false) classes.delete(cls);
        else if (classes.has(cls)) classes.delete(cls);
        else classes.add(cls);
      },
      contains: (cls: string) => classes.has(cls),
    },
    style: {},
    textContent: '',
    innerHTML: '',
    listeners,
    addEventListener: (event: string, cb: (e?: unknown) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: (e?: unknown) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb);
      }
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    getAttribute: (attr: string) => attrs[attr] ?? null,
    setAttribute: (attr: string, val: string) => {
      attrs[attr] = val;
    },
    closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 }),
  };

  return el;
}

describe('CaptionOverlay Draft Recovery Across Page Reloads', () => {
  let mockStorage: Record<string, unknown> = {};
  let elementsById: Map<string, MockElement>;
  let windowListeners: Record<string, ((e?: unknown) => void)[]>;
  let mockShadowRoot: {
    appendChild: (child: unknown) => void;
    getElementById: (id: string) => MockElement | null;
    querySelectorAll: (sel: string) => MockElement[];
  };
  let mockAdapter: PlatformAdapter;

  beforeEach(() => {
    mockStorage = {};
    elementsById = new Map();
    windowListeners = {};

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
      innerWidth: 1920,
      innerHeight: 1080,
      confirm: vi.fn(() => true),
    };

    (globalThis as unknown as { document: unknown }).document = {
      title: 'Google Meet',
      createElement: (tag: string) => createMockElement(tag),
    };

    mockShadowRoot = {
      appendChild: vi.fn(),
      getElementById: (id: string) => {
        if (!elementsById.has(id)) {
          elementsById.set(id, createMockElement('div', id));
        }
        return elementsById.get(id)!;
      },
      querySelectorAll: (sel: string) => {
        if (sel === '.cr-tab') {
          return [createMockElement('button'), createMockElement('button')];
        }
        return [];
      },
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
      endTime: 1060000, // 60 seconds duration
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
      aiSummary: '### Executive Summary\nAll points covered.',
    };
  }

  it('restores draft session segments, duration, stats, AI summary, and drawer on mount', async () => {
    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);

    // Wait for async restoration promise to complete
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    const session = (overlay as unknown as { session: MeetingSession }).session;
    expect(session.id).toBe('session_saved_123');
    expect(session.segments.length).toBe(2);
    expect(session.segments[0].speaker).toBe('Denis');
    expect(session.aiSummary).toBe('### Executive Summary\nAll points covered.');

    // Timer should be restored to 60 seconds: 00:01:00
    const timerEl = elementsById.get('cr-timer');
    expect(timerEl?.textContent).toBe('00:01:00');

    // Stats should be restored
    const wordCountEl = elementsById.get('cr-stat-words');
    const turnCountEl = elementsById.get('cr-stat-turns');
    expect(turnCountEl?.textContent).toBe('2');
    expect(Number(wordCountEl?.textContent)).toBeGreaterThan(0);

    // AI summary box should display restored summary
    const aiOutputEl = elementsById.get('cr-ai-output');
    expect(aiOutputEl?.textContent).toBe('### Executive Summary\nAll points covered.');

    // Since draft.endTime was set (meeting completed), drawer should be open
    const drawerEl = elementsById.get('cr-drawer');
    expect(drawerEl?.classList.contains('cr-open')).toBe(true);

    // Ticker shows the last caption
    const tickerEl = elementsById.get('cr-ticker');
    expect(tickerEl?.textContent).toContain('Alice:');
  });

  it('flushes pending captions and saves draft immediately on window beforeunload or pagehide', async () => {
    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    // Simulate active recording with 1 segment
    (overlay as unknown as { status: string }).status = 'recording';
    (overlay as unknown as { session: MeetingSession }).session.segments.push({
      id: 'seg_unload',
      speaker: 'You',
      startTime: 2000,
      endTime: 3000,
      text: 'Final words before leaving call',
    });

    // Verify beforeunload listener was registered
    expect(windowListeners['beforeunload']?.length).toBeGreaterThan(0);

    // Trigger beforeunload
    windowListeners['beforeunload'][0]();

    // Adapter flush should be called
    expect(mockAdapter.flush).toHaveBeenCalled();

    // Draft should be written immediately to storage
    const saved = mockStorage['caption_recorder_unsaved_draft'] as MeetingSession;
    expect(saved).toBeDefined();
    expect(saved.segments.length).toBe(1);
    expect(saved.segments[0].text).toBe('Final words before leaving call');
    expect(saved.endTime).toBeDefined();
  });

  it('resets session and clears storage when resetSession is executed', async () => {
    const draft = createSavedMeetingDraft();
    await DraftStorageService.saveDraftImmediate(draft);

    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    expect((overlay as unknown as { session: MeetingSession }).session.segments.length).toBe(2);

    // Call resetSession
    await (overlay as unknown as { resetSession: () => Promise<void> }).resetSession();

    // Storage is cleared
    expect(mockStorage['caption_recorder_unsaved_draft']).toBeUndefined();

    // Session is fresh and empty
    const session = (overlay as unknown as { session: MeetingSession }).session;
    expect(session.segments.length).toBe(0);
    expect((overlay as unknown as { elapsedSeconds: number }).elapsedSeconds).toBe(0);

    const timerEl = elementsById.get('cr-timer');
    expect(timerEl?.textContent).toBe('00:00:00');

    const turnCountEl = elementsById.get('cr-stat-turns');
    expect(turnCountEl?.textContent).toBe('0');
  });

  it('appends new caption turns to restored active session without clobbering', async () => {
    const draft = createSavedMeetingDraft();
    // Simulate active reload (no endTime)
    delete draft.endTime;
    await DraftStorageService.saveDraftImmediate(draft);

    let onCaptionCb: (cap: InterimCaption) => void = () => {};
    mockAdapter.observe = vi.fn((cb) => {
      onCaptionCb = cb;
    });

    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    (overlay as unknown as { status: string }).status = 'recording';

    // Incoming new speech chunk after page reload
    await onCaptionCb({
      speaker: 'Bob',
      text: 'Resumed meeting turn',
      timestamp: 1070000,
    });

    const session = (overlay as unknown as { session: MeetingSession }).session;
    expect(session.segments.length).toBe(3);
    expect(session.segments[0].speaker).toBe('Denis');
    expect(session.segments[1].speaker).toBe('Alice');
    expect(session.segments[2].speaker).toBe('Bob');
    expect(session.segments[2].text).toBe('Resumed meeting turn');
  });

  it('optimizes transcript rendering by skipping DOM updates when drawer is closed and caching finalized segments', async () => {
    let onCaptionCb: (cap: InterimCaption) => void = () => {};
    let onActiveCaptionCb: (cap: InterimCaption | null) => void = () => {};
    mockAdapter.observe = vi.fn((cb, _, activeCb) => {
      onCaptionCb = cb;
      if (activeCb) onActiveCaptionCb = activeCb;
    });

    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    const drawerEl = elementsById.get('cr-drawer')!;
    const transcriptListEl = elementsById.get('cr-transcript-list')!;
    expect(drawerEl.classList.contains('cr-open')).toBe(false);

    // Set a sentinel string in the transcript DOM
    transcriptListEl.innerHTML = 'SENTINEL_CLOSED_DRAWER';

    (overlay as unknown as { status: string }).status = 'recording';

    // Incoming interim caption while drawer is closed
    await onActiveCaptionCb({
      speaker: 'Denis',
      text: 'Speaking while drawer is closed',
      timestamp: 2000,
    });

    // Transcript DOM should NOT be re-rendered or touched while drawer is closed
    expect(transcriptListEl.innerHTML).toBe('SENTINEL_CLOSED_DRAWER');

    // Finalized caption while drawer is closed
    await onCaptionCb({
      speaker: 'Denis',
      text: 'Final sentence while drawer is closed',
      timestamp: 3000,
    });

    // Transcript DOM still NOT touched
    expect(transcriptListEl.innerHTML).toBe('SENTINEL_CLOSED_DRAWER');

    // Opening drawer renders all buffered segments
    (overlay as unknown as { openDrawer: () => void }).openDrawer();
    expect(drawerEl.classList.contains('cr-open')).toBe(true);
    expect(transcriptListEl.innerHTML).toContain('Final sentence while drawer is closed');

    // Subsequent interim caption with drawer open appends the active turn without discarding segment cache
    await onActiveCaptionCb({
      speaker: 'Alice',
      text: 'Live drafting with drawer open',
      timestamp: 4000,
    });
    expect(transcriptListEl.innerHTML).toContain('Final sentence while drawer is closed');
    expect(transcriptListEl.innerHTML).toContain('Live drafting with drawer open');
    expect(transcriptListEl.innerHTML).toContain('cr-active-turn');
  });

  it('updates word and turn stats accurately with live active drafts and finalized segments', async () => {
    let onCaptionCb: (cap: InterimCaption) => void = () => {};
    let onActiveCaptionCb: (cap: InterimCaption | null) => void = () => {};
    mockAdapter.observe = vi.fn((cb, _, activeCb) => {
      onCaptionCb = cb;
      if (activeCb) onActiveCaptionCb = activeCb;
    });

    const overlay = new CaptionOverlay(mockShadowRoot as unknown as ShadowRoot, mockAdapter);
    await (overlay as unknown as { restorePromise: Promise<void> }).restorePromise;

    (overlay as unknown as { status: string }).status = 'recording';

    const wordCountEl = elementsById.get('cr-stat-words')!;
    const turnCountEl = elementsById.get('cr-stat-turns')!;

    expect(wordCountEl.textContent).toBe('0');
    expect(turnCountEl.textContent).toBe('0');

    // 1. Interim active caption with 3 words
    await onActiveCaptionCb({
      speaker: 'Denis',
      text: 'One two three',
      timestamp: 1000,
    });
    expect(wordCountEl.textContent).toBe('3');
    expect(turnCountEl.textContent).toBe('1');

    // 2. Active caption evolves to 5 words
    await onActiveCaptionCb({
      speaker: 'Denis',
      text: 'One two three four five',
      timestamp: 1100,
    });
    expect(wordCountEl.textContent).toBe('5');
    expect(turnCountEl.textContent).toBe('1');

    // 3. Finalize first turn (5 words)
    await onCaptionCb({
      speaker: 'Denis',
      text: 'One two three four five',
      timestamp: 1200,
    });
    await onActiveCaptionCb(null);
    expect(wordCountEl.textContent).toBe('5');
    expect(turnCountEl.textContent).toBe('1');

    // 4. Second speaker speaks 4 words in active draft
    await onActiveCaptionCb({
      speaker: 'Alice',
      text: 'Six seven eight nine',
      timestamp: 2000,
    });
    expect(wordCountEl.textContent).toBe('9'); // 5 finalized + 4 active
    expect(turnCountEl.textContent).toBe('2'); // 1 finalized + 1 active

    // 5. Finalize second turn
    await onCaptionCb({
      speaker: 'Alice',
      text: 'Six seven eight nine',
      timestamp: 2100,
    });
    await onActiveCaptionCb(null);
    expect(wordCountEl.textContent).toBe('9');
    expect(turnCountEl.textContent).toBe('2');

    // 6. Reset session resets stats to 0
    await (overlay as unknown as { resetSession: () => Promise<void> }).resetSession();
    expect(wordCountEl.textContent).toBe('0');
    expect(turnCountEl.textContent).toBe('0');
  });
});
