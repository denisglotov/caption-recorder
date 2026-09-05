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
    it('resolves action API across Chrome MV3, Firefox MV3, and Firefox MV2', () => {
      expect(getActionApi()).toBe((chrome as unknown as { action: unknown }).action);

      const mockAction = {
        setBadgeText: vi.fn(),
        onClicked: { addListener: vi.fn() },
      };
      delete (globalThis as unknown as { chrome?: { action?: unknown } }).chrome?.action;
      (globalThis as unknown as { browser: unknown }).browser = {
        action: mockAction,
      };

      expect(getActionApi()).toBe(mockAction);

      const mockBrowserAction = {
        setBadgeText: vi.fn(),
        onClicked: { addListener: vi.fn() },
      };
      delete (globalThis as unknown as { browser?: { action?: unknown } }).browser?.action;
      (globalThis as unknown as { browser: { browserAction: unknown } }).browser.browserAction =
        mockBrowserAction;

      expect(getActionApi()).toBe(mockBrowserAction);
      delete (globalThis as unknown as { browser?: unknown }).browser;
    });
  });

  describe('getSidebarActionApi', () => {
    it('returns browser.sidebarAction when present and undefined when missing', () => {
      expect(getSidebarActionApi()).toBeUndefined();

      const mockSidebar = { toggle: vi.fn(), open: vi.fn() };
      (globalThis as unknown as { browser: unknown }).browser = {
        sidebarAction: mockSidebar,
      };

      expect(getSidebarActionApi()).toBe(mockSidebar);
      delete (globalThis as unknown as { browser?: unknown }).browser;
    });
  });

  describe('updateActionBadge', () => {
    it('updates or clears action badge for Chrome and Firefox', async () => {
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

      await updateActionBadge('idle', 123);
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 123 });

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
    it('sets popup for app/popup windows and clears for normal browser windows', async () => {
      await syncWindowActionBehavior(101);
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'pwa-popup.html' });

      await syncWindowActionBehavior(102);
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: 'pwa-popup.html' });

      await syncWindowActionBehavior(103);
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ popup: '' });
      expect(chrome.action.setPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
    });

    it('falls back to last focused window when windowId is omitted', async () => {
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

    it('toggles or opens sidebar in Firefox', async () => {
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
        expect(chrome.sidePanel.open).not.toHaveBeenCalled();

        delete (globalThis as unknown as { browser?: { sidebarAction?: { toggle?: unknown } } })
          .browser?.sidebarAction?.toggle;
        await handleActionClick(tab);

        expect(mockSidebarOpen).toHaveBeenCalled();
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
  });
});
