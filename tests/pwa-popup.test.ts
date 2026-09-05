import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateStatus, setupListeners, initPopup } from '../src/entrypoints/pwa-popup/main';

describe('pwa-popup/main.ts Logic', () => {
  let mockStorage: Record<string, unknown> = {};
  let storageChangedCallbacks: ((changes: Record<string, unknown>, area: string) => void)[] = [];
  let domElements: Record<string, HTMLElement> = {};

  beforeEach(() => {
    mockStorage = {};
    storageChangedCallbacks = [];
    domElements = {};

    const createElement = (id: string, initialStyle: Record<string, string> = {}) => {
      const el = {
        id,
        textContent: '',
        className: '',
        style: { ...initialStyle },
        addEventListener: vi.fn(),
        click: vi.fn(),
      } as unknown as HTMLElement;
      domElements[id] = el;
      return el;
    };

    createElement('status-pill');
    createElement('status-text');
    createElement('pwa-title');
    createElement('pwa-desc');
    createElement('btn-dismiss-pwa');

    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => domElements[id] || null,
    };

    (globalThis as unknown as { window: unknown }).window = {
      close: vi.fn(),
    };

    (globalThis as unknown as Record<string, unknown>).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
        },
        onChanged: {
          addListener: vi.fn((cb) => {
            storageChangedCallbacks.push(cb);
          }),
          removeListener: vi.fn(),
        },
      },
      i18n: {
        getUILanguage: () => 'en',
      },
    };
  });

  it('initializes popup with localized UI and reflects current recording status', async () => {
    await initPopup();
    expect(domElements['pwa-title'].textContent).toBe('Recording in Background');
    expect(domElements['pwa-desc'].textContent).toContain(
      'side panel is only available in regular browser tabs'
    );
    expect(domElements['btn-dismiss-pwa'].textContent).toBe('Got it');
    expect(domElements['status-pill'].className).toBe('status-pill status-idle');
    expect(domElements['status-text'].textContent).toBe('Idle');

    mockStorage['caption_recorder_recording_state'] = {
      status: 'recording',
      tabId: 1,
    };
    await updateStatus();
    expect(domElements['status-pill'].className).toBe('status-pill status-recording');
    expect(domElements['status-text'].textContent).toBe('Recording');
  });

  it('handles dismiss click and syncs status when storage changes', async () => {
    let clickHandler: (() => void) | null = null;
    domElements['btn-dismiss-pwa'].addEventListener = vi.fn((event, cb) => {
      if (event === 'click') clickHandler = cb as () => void;
    });

    setupListeners();
    expect(clickHandler).not.toBeNull();
    clickHandler!();
    expect(window.close).toHaveBeenCalled();

    mockStorage['caption_recorder_recording_state'] = {
      status: 'recording',
      tabId: 1,
    };
    for (const cb of storageChangedCallbacks) {
      cb(
        {
          caption_recorder_recording_state: {
            newValue: mockStorage['caption_recorder_recording_state'],
          },
        },
        'local'
      );
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(domElements['status-pill'].className).toBe('status-pill status-recording');
  });
});
