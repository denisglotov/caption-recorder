import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initContentScript } from '../src/entrypoints/content';
import type { ContentScriptContext } from 'wxt/client';

describe('content.ts Content Script Lifecycle', () => {
  let mockStorage: Record<string, unknown> = {};
  let eventListeners: Record<string, ((event?: unknown) => void)[]> = {};
  let invalidatedCallbacks: (() => void)[] = [];
  let mockCtx: ContentScriptContext;

  beforeEach(() => {
    mockStorage = {};
    eventListeners = {};
    invalidatedCallbacks = [];

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
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        id: 'test_ext_id',
        sendMessage: vi.fn(async () => ({ success: true })),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      i18n: {
        getUILanguage: () => 'en',
      },
    };

    (globalThis as unknown as { window: unknown }).window = {
      location: {
        href: 'https://meet.google.com/abc-defg-hij',
        pathname: '/abc-defg-hij',
        origin: 'https://meet.google.com',
      },
      addEventListener: vi.fn((event: string, cb: (e?: unknown) => void) => {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(cb);
      }),
      removeEventListener: vi.fn(),
    };

    (globalThis as unknown as { document: unknown }).document = {
      title: 'Google Meet',
      body: {
        contains: () => true,
      },
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    (globalThis as unknown as { MutationObserver: unknown }).MutationObserver = vi
      .fn()
      .mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      }));

    mockCtx = {
      addEventListener: vi.fn((_target: unknown, type: string, handler: (e?: unknown) => void) => {
        eventListeners[type] = eventListeners[type] || [];
        eventListeners[type].push(handler);
      }),
      onInvalidated: vi.fn((cb: () => void) => {
        invalidatedCallbacks.push(cb);
        return () => {};
      }),
    } as unknown as ContentScriptContext;
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
    delete (globalThis as unknown as { MutationObserver?: unknown }).MutationObserver;
    vi.restoreAllMocks();
  });

  describe('initContentScript', () => {
    it('initializes a SessionRecorder when an adapter matches the URL', () => {
      const { getRecorder } = initContentScript(mockCtx);
      const recorder = getRecorder();

      expect(recorder).not.toBeNull();
      recorder?.destroy();
    });

    it('does not initialize a SessionRecorder on an unhandled URL', () => {
      (window as unknown as { location: { href: string } }).location.href =
        'https://meet.google.com/';
      const { getRecorder } = initContentScript(mockCtx);

      expect(getRecorder()).toBeNull();
    });

    it('destroys the recorder when navigating to an unhandled URL', () => {
      const { getRecorder } = initContentScript(mockCtx);
      const initialRecorder = getRecorder();
      expect(initialRecorder).not.toBeNull();

      const destroySpy = vi.spyOn(initialRecorder!, 'destroy');

      (window as unknown as { location: { href: string } }).location.href =
        'https://meet.google.com/landing';

      eventListeners['wxt:locationchange']?.forEach((cb) => cb());

      expect(destroySpy).toHaveBeenCalled();
      expect(getRecorder()).toBeNull();
    });

    it('preserves the active recorder when URL changes within the same call according to adapter', () => {
      const { getRecorder } = initContentScript(mockCtx);
      const initialRecorder = getRecorder();
      expect(initialRecorder).not.toBeNull();

      const destroySpy = vi.spyOn(initialRecorder!, 'destroy');

      (window as unknown as { location: { href: string } }).location.href =
        'https://meet.google.com/abc-defg-hij?authuser=1';

      eventListeners['wxt:locationchange']?.forEach((cb) => cb());

      expect(destroySpy).not.toHaveBeenCalled();
      expect(getRecorder()).toBe(initialRecorder);
      initialRecorder?.destroy();
    });

    it('destroys old recorder and creates a new recorder when changing calls', () => {
      const { getRecorder } = initContentScript(mockCtx);
      const firstRecorder = getRecorder();
      expect(firstRecorder).not.toBeNull();

      const firstDestroySpy = vi.spyOn(firstRecorder!, 'destroy');

      (window as unknown as { location: { href: string } }).location.href =
        'https://meet.google.com/xyz-uvwx-rst';

      eventListeners['wxt:locationchange']?.forEach((cb) => cb());

      expect(firstDestroySpy).toHaveBeenCalled();

      const secondRecorder = getRecorder();
      expect(secondRecorder).not.toBeNull();
      expect(secondRecorder).not.toBe(firstRecorder);

      secondRecorder?.destroy();
    });

    it('destroys recorder on context invalidation', () => {
      const { getRecorder } = initContentScript(mockCtx);
      const recorder = getRecorder();
      expect(recorder).not.toBeNull();

      const destroySpy = vi.spyOn(recorder!, 'destroy');

      expect(invalidatedCallbacks.length).toBeGreaterThan(0);
      invalidatedCallbacks.forEach((cb) => cb());

      expect(destroySpy).toHaveBeenCalled();
      expect(getRecorder()).toBeNull();
    });
  });
});
