import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncWindowActionBehavior,
  handleActionClick,
  getActionApi,
  getSidebarActionApi,
  updateActionBadge,
} from '../src/entrypoints/background';

describe('background window sync and action click', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (globalThis as unknown as { chrome: unknown }).chrome = {
      action: {
        setPopup: vi.fn(async () => {}),
        setBadgeText: vi.fn(async () => {}),
        setBadgeBackgroundColor: vi.fn(async () => {}),
        setBadgeTextColor: vi.fn(async () => {}),
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

  describe('getActionApi', () => {
    it('returns chrome.action if present', () => {
      const api = getActionApi();
      expect(api).toBe((chrome as unknown as { action: unknown }).action);
    });

    it('returns browser.browserAction in Firefox MV2 when chrome.action is missing', () => {
      const mockBrowserAction = {
        setBadgeText: vi.fn(),
        onClicked: { addListener: vi.fn() },
      };
      delete (globalThis as unknown as { chrome?: { action?: unknown } }).chrome?.action;
      (globalThis as unknown as { browser: unknown }).browser = {
        browserAction: mockBrowserAction,
      };

      try {
        const api = getActionApi();
        expect(api).toBe(mockBrowserAction);
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });

    it('returns browser.action in Firefox MV3 when chrome.action is missing', () => {
      const mockAction = {
        setBadgeText: vi.fn(),
        onClicked: { addListener: vi.fn() },
      };
      delete (globalThis as unknown as { chrome?: { action?: unknown } }).chrome?.action;
      (globalThis as unknown as { browser: unknown }).browser = {
        action: mockAction,
      };

      try {
        const api = getActionApi();
        expect(api).toBe(mockAction);
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });
  });

  describe('getSidebarActionApi', () => {
    it('returns browser.sidebarAction when present', () => {
      const mockSidebar = { toggle: vi.fn(), open: vi.fn() };
      (globalThis as unknown as { browser: unknown }).browser = {
        sidebarAction: mockSidebar,
      };

      try {
        expect(getSidebarActionApi()).toBe(mockSidebar);
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });

    it('returns undefined when browser.sidebarAction is missing', () => {
      expect(getSidebarActionApi()).toBeUndefined();
    });
  });

  describe('updateActionBadge', () => {
    it('sets REC badge with background and text color when recording', async () => {
      await updateActionBadge('recording', 123);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: 'REC', tabId: 123 });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#EF4444',
        tabId: 123,
      });
      expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
        color: '#FFFFFF',
        tabId: 123,
      });
    });

    it('clears badge text when idle', async () => {
      await updateActionBadge('idle', 123);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 123 });
    });

    it('works with Firefox browserAction when chrome.action is undefined', async () => {
      const mockSetBadgeText = vi.fn(async () => {});
      const mockSetBadgeBackgroundColor = vi.fn(async () => {});
      const mockSetBadgeTextColor = vi.fn(async () => {});

      delete (globalThis as unknown as { chrome?: { action?: unknown } }).chrome?.action;
      (globalThis as unknown as { browser: unknown }).browser = {
        browserAction: {
          setBadgeText: mockSetBadgeText,
          setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
          setBadgeTextColor: mockSetBadgeTextColor,
        },
      };

      try {
        await updateActionBadge('recording', 456);

        expect(mockSetBadgeText).toHaveBeenCalledWith({ text: 'REC', tabId: 456 });
        expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({
          color: '#EF4444',
          tabId: 456,
        });
        expect(mockSetBadgeTextColor).toHaveBeenCalledWith({ color: '#FFFFFF', tabId: 456 });
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });
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

    it('works with browserAction in Firefox MV2', async () => {
      const mockSetPopup = vi.fn(async () => {});
      delete (globalThis as unknown as { chrome?: { action?: unknown } }).chrome?.action;
      (globalThis as unknown as { browser: unknown }).browser = {
        browserAction: {
          setPopup: mockSetPopup,
        },
      };

      try {
        await syncWindowActionBehavior(103);
        expect(mockSetPopup).toHaveBeenCalledWith({ popup: '' });
        expect(mockSetPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });
  });

  describe('handleActionClick', () => {
    it('opens side panel directly in normal Chrome windows', async () => {
      const tab = { id: 10, windowId: 201 } as chrome.tabs.Tab;
      await handleActionClick(tab);

      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 201 });
      expect(chrome.action.setPopup).not.toHaveBeenCalled();
    });

    it('toggles sidebar in Firefox when browser.sidebarAction.toggle is present', async () => {
      const mockSidebarToggle = vi.fn(async () => {});
      const mockSidebarOpen = vi.fn(async () => {});
      (globalThis as unknown as { browser: unknown }).browser = {
        sidebarAction: {
          toggle: mockSidebarToggle,
          open: mockSidebarOpen,
        },
      };

      try {
        const tab = { id: 20, windowId: 202 } as chrome.tabs.Tab;
        await handleActionClick(tab);

        expect(mockSidebarToggle).toHaveBeenCalled();
        expect(mockSidebarOpen).not.toHaveBeenCalled();
        expect(chrome.sidePanel.open).not.toHaveBeenCalled();
      } finally {
        delete (globalThis as unknown as { browser?: unknown }).browser;
      }
    });

    it('opens sidebar in Firefox when only browser.sidebarAction.open is present', async () => {
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
