import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncWindowActionBehavior, handleActionClick } from '../src/entrypoints/background';

describe('background window sync and action click', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (globalThis as unknown as { chrome: unknown }).chrome = {
      action: {
        setPopup: vi.fn(async () => {}),
      },
      sidePanel: {
        open: vi.fn(async () => {}),
      },
      windows: {
        WINDOW_ID_NONE: -1,
        get: vi.fn(async (id: number) => {
          if (id === 101) return { id, type: 'app', tabs: [{ id: 1 }, { id: 2 }] };
          if (id === 102) return { id, type: 'popup', tabs: [{ id: 3 }] };
          if (id === 103) return { id, type: 'normal', tabs: [{ id: 4 }] };
          throw new Error('Window not found');
        }),
        getLastFocused: vi.fn(async () => ({ id: 101, type: 'app' })),
      },
    };
  });

  describe('syncWindowActionBehavior', () => {
    it('sets pwa-popup.html for app windows and their tabs', async () => {
      await syncWindowActionBehavior(101);

      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'pwa-popup.html' });
    });

    it('sets pwa-popup.html for standalone popup windows', async () => {
      await syncWindowActionBehavior(102);

      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: 'pwa-popup.html' });
    });

    it('clears popup for normal browser windows', async () => {
      await syncWindowActionBehavior(103);

      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: '' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
    });

    it('falls back to getLastFocused when windowId is omitted', async () => {
      await syncWindowActionBehavior();

      expect(chrome.windows.getLastFocused).toHaveBeenCalled();
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
    });
  });

  describe('handleActionClick', () => {
    it('opens side panel directly in normal Chrome windows', async () => {
      const tab = { id: 10, windowId: 201 } as chrome.tabs.Tab;
      await handleActionClick(tab);

      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 201 });
      expect(chrome.action.setPopup).not.toHaveBeenCalled();
    });

    it('opens sidebar in Firefox when browser.sidebarAction is present', async () => {
      const mockSidebarOpen = vi.fn(async () => {});
      (globalThis as unknown as { browser: unknown }).browser = {
        sidebarAction: {
          open: mockSidebarOpen,
        },
      };

      try {
        const tab = { id: 20, windowId: 202 } as chrome.tabs.Tab;
        await handleActionClick(tab);

        expect(mockSidebarOpen).toHaveBeenCalled();
        expect(chrome.sidePanel.open).not.toHaveBeenCalled();
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });

    it('attaches pwa-popup when sidePanel.open fails in app window', async () => {
      (chrome.sidePanel.open as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Side panel not supported in app window')
      );

      const tab = { id: 30, windowId: 203 } as chrome.tabs.Tab;
      await handleActionClick(tab);

      expect(chrome.action.setPopup).toHaveBeenCalledWith({
        tabId: 30,
        popup: 'pwa-popup.html',
      });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({
        popup: 'pwa-popup.html',
      });
    });

    it('does nothing if windowId is missing', async () => {
      const tab = { id: 40 } as chrome.tabs.Tab;
      await handleActionClick(tab);

      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
      expect(chrome.action.setPopup).not.toHaveBeenCalled();
    });
  });
});
