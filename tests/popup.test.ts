import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  localizeUI,
  updateStatus,
  checkWindowMode,
  setupListeners,
  initPopup,
} from '../src/entrypoints/popup/main';

describe('popup/main.ts Logic', () => {
  let mockStorage: Record<string, unknown> = {};
  let storageChangedCallbacks: ((changes: Record<string, unknown>, area: string) => void)[] = [];
  let domElements: Record<string, HTMLElement> = {};

  beforeEach(() => {
    mockStorage = {};
    storageChangedCallbacks = [];
    domElements = {};

    // Mock DOM elements
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
    createElement('view-pwa', { display: 'none' });
    createElement('view-normal', { display: 'flex' });
    createElement('pwa-title');
    createElement('pwa-desc');
    createElement('btn-open-sidepanel');

    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => domElements[id] || null,
    };

    (globalThis as unknown as { window: unknown }).window = {
      close: vi.fn(),
    };

    (globalThis as unknown as { chrome: unknown }).chrome = {
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
      windows: {
        getLastFocused: vi.fn(async () => ({ id: 101, type: 'app' })),
        get: vi.fn(async (id: number) => ({ id, type: 'normal' })),
      },
      tabs: {
        query: vi.fn(async () => [{ id: 1, windowId: 101, active: true }]),
      },
      sidePanel: {
        open: vi.fn(async () => {}),
      },
      i18n: {
        getUILanguage: () => 'en',
      },
    };
  });

  describe('localizeUI', () => {
    it('sets localized PWA title and description', () => {
      localizeUI();
      expect(domElements['pwa-title'].textContent).toBe('Recording in Background');
      expect(domElements['pwa-desc'].textContent).toContain(
        'side panel is only available in regular browser tabs'
      );
    });
  });

  describe('updateStatus', () => {
    it('renders idle status when no recording state exists', async () => {
      await updateStatus();
      expect(domElements['status-pill'].className).toBe('status-pill status-idle');
      expect(domElements['status-text'].textContent).toBe('Idle');
    });

    it('renders recording status when status is recording', async () => {
      mockStorage['caption_recorder_recording_state'] = {
        status: 'recording',
        tabId: 1,
      };
      await updateStatus();
      expect(domElements['status-pill'].className).toBe('status-pill status-recording');
      expect(domElements['status-text'].textContent).toBe('Recording');
    });
  });

  describe('checkWindowMode', () => {
    it('shows PWA view and hides normal view when window type is app', async () => {
      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 101,
        type: 'app',
      });

      await checkWindowMode();

      expect(domElements['view-pwa'].style.display).toBe('flex');
      expect(domElements['view-normal'].style.display).toBe('none');
    });

    it('shows PWA view when window type is popup (standalone mode)', async () => {
      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 102,
        type: 'popup',
      });

      await checkWindowMode();

      expect(domElements['view-pwa'].style.display).toBe('flex');
      expect(domElements['view-normal'].style.display).toBe('none');
    });

    it('shows normal view and hides PWA view when window type is normal', async () => {
      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 103,
        type: 'normal',
      });

      await checkWindowMode();

      expect(domElements['view-pwa'].style.display).toBe('none');
      expect(domElements['view-normal'].style.display).toBe('flex');
    });

    it('falls back to tabs.query if getLastFocused fails', async () => {
      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('getLastFocused failed')
      );
      (chrome.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 2, windowId: 202, active: true },
      ]);
      (chrome.windows.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 202,
        type: 'app',
      });

      await checkWindowMode();

      expect(domElements['view-pwa'].style.display).toBe('flex');
      expect(domElements['view-normal'].style.display).toBe('none');
    });
  });

  describe('setupListeners', () => {
    it('opens side panel and closes popup when Open Side Panel button is clicked', async () => {
      let clickHandler: (() => Promise<void>) | null = null;
      domElements['btn-open-sidepanel'].addEventListener = vi.fn((event, cb) => {
        if (event === 'click') clickHandler = cb as () => Promise<void>;
      });

      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 303,
        type: 'normal',
      });

      setupListeners();
      expect(clickHandler).not.toBeNull();

      await clickHandler!();

      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 303 });
      expect(window.close).toHaveBeenCalled();
    });

    it('updates status when storage changes', async () => {
      setupListeners();
      expect(storageChangedCallbacks.length).toBeGreaterThan(0);

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

  describe('initPopup', () => {
    it('initializes popup localization, listeners, status, and window mode', async () => {
      (chrome.windows.getLastFocused as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 404,
        type: 'app',
      });

      await initPopup();

      expect(domElements['pwa-title'].textContent).toBe('Recording in Background');
      expect(domElements['view-pwa'].style.display).toBe('flex');
    });
  });
});
