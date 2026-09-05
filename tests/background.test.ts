import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncWindowActionBehavior,
  handleActionClick,
  updateActionBadge,
} from '../src/entrypoints/background';
import { browser } from 'wxt/browser';

describe('background window sync and action click', () => {
  let mockAction: {
    setPopup: ReturnType<typeof vi.fn>;
    setBadgeText: ReturnType<typeof vi.fn>;
    setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
    setBadgeTextColor: ReturnType<typeof vi.fn>;
  };
  let mockSidePanelOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const g = globalThis as unknown as { browser: Record<string, unknown> };
    g.browser = g.browser || {};

    mockAction = {
      setPopup: vi.fn(async () => {}),
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {}),
      setBadgeTextColor: vi.fn(async () => {}),
    };
    mockSidePanelOpen = vi.fn(async () => {});

    g.browser.action = mockAction;
    (browser as unknown as Record<string, unknown>).sidePanel = {
      open: mockSidePanelOpen,
    };
    (browser as unknown as Record<string, unknown>).windows = {
      WINDOW_ID_NONE: -1,
      get: vi.fn(async (id: number) => {
        if (id === 101) return { id, type: 'app', tabs: [{ id: 1 }, { id: 2 }] };
        if (id === 102) return { id, type: 'popup', tabs: [{ id: 3 }] };
        if (id === 103) return { id, type: 'normal', tabs: [{ id: 4 }] };
        throw new Error('Window not found');
      }),
      getLastFocused: vi.fn(async () => ({ id: 101, type: 'app' })),
    };
  });

  afterEach(() => {
    const g = globalThis as unknown as { browser?: Record<string, unknown> };
    delete g.browser;
  });

  describe('updateActionBadge', () => {
    it('updates or clears action badge', async () => {
      await updateActionBadge('recording', 123);

      expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: 'REC', tabId: 123 });
      expect(mockAction.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#EF4444',
        tabId: 123,
      });
      expect(mockAction.setBadgeTextColor).toHaveBeenCalledWith({
        color: '#FFFFFF',
        tabId: 123,
      });

      await updateActionBadge('idle', 123);
      expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 123 });
    });

    it('falls back to browserAction when action is not available (Firefox MV2)', async () => {
      const mockBrowserAction = {
        setBadgeText: vi.fn(async () => {}),
        setBadgeBackgroundColor: vi.fn(async () => {}),
        setBadgeTextColor: vi.fn(async () => {}),
      };
      const g = globalThis as unknown as { browser: Record<string, unknown> };
      delete g.browser.action;
      g.browser.browserAction = mockBrowserAction;

      try {
        await updateActionBadge('recording', 456);
        expect(mockBrowserAction.setBadgeText).toHaveBeenCalledWith({ text: 'REC', tabId: 456 });
        expect(mockBrowserAction.setBadgeBackgroundColor).toHaveBeenCalledWith({
          color: '#EF4444',
          tabId: 456,
        });
        expect(mockBrowserAction.setBadgeTextColor).toHaveBeenCalledWith({
          color: '#FFFFFF',
          tabId: 456,
        });
      } finally {
        delete g.browser.browserAction;
      }
    });
  });

  describe('syncWindowActionBehavior', () => {
    it('sets popup for app/popup windows and clears for normal browser windows', async () => {
      await syncWindowActionBehavior(101);
      expect(mockAction.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(mockAction.setPopup).toHaveBeenCalledWith({ tabId: 1, popup: 'pwa-popup.html' });
      expect(mockAction.setPopup).toHaveBeenCalledWith({ tabId: 2, popup: 'pwa-popup.html' });

      await syncWindowActionBehavior(102);
      expect(mockAction.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
      expect(mockAction.setPopup).toHaveBeenCalledWith({ tabId: 3, popup: 'pwa-popup.html' });

      await syncWindowActionBehavior(103);
      expect(mockAction.setPopup).toHaveBeenCalledWith({ popup: '' });
      expect(mockAction.setPopup).toHaveBeenCalledWith({ tabId: 4, popup: '' });
    });

    it('falls back to last focused window when windowId is omitted', async () => {
      await syncWindowActionBehavior();

      expect(browser.windows.getLastFocused).toHaveBeenCalled();
      expect(mockAction.setPopup).toHaveBeenCalledWith({ popup: 'pwa-popup.html' });
    });
  });

  describe('handleActionClick', () => {
    it('opens side panel directly in normal Chrome windows', async () => {
      const tab = { id: 10, windowId: 201 } as import('wxt/browser').Tabs.Tab;
      await handleActionClick(tab);

      expect(mockSidePanelOpen).toHaveBeenCalledWith({ windowId: 201 });
      expect(mockAction.setPopup).not.toHaveBeenCalled();
    });

    it('toggles or opens sidebar in Firefox', async () => {
      const mockSidebarToggle = vi.fn(async () => {});
      const mockSidebarOpen = vi.fn(async () => {});
      (browser as unknown as Record<string, unknown>).sidebarAction = {
        toggle: mockSidebarToggle,
        open: mockSidebarOpen,
      };

      try {
        const tab = { id: 20, windowId: 202 } as import('wxt/browser').Tabs.Tab;
        await handleActionClick(tab);

        expect(mockSidebarToggle).toHaveBeenCalled();
        expect(mockSidePanelOpen).not.toHaveBeenCalled();

        delete (browser as unknown as { sidebarAction?: { toggle?: unknown } }).sidebarAction
          ?.toggle;
        await handleActionClick(tab);

        expect(mockSidebarOpen).toHaveBeenCalled();
      } finally {
        delete (browser as unknown as { sidebarAction?: unknown }).sidebarAction;
      }
    });

    it('attaches pwa-popup when sidePanel.open fails in app window', async () => {
      mockSidePanelOpen.mockRejectedValueOnce(new Error('Side panel not supported in app window'));

      const tab = { id: 30, windowId: 203 } as import('wxt/browser').Tabs.Tab;
      await handleActionClick(tab);

      expect(mockAction.setPopup).toHaveBeenCalledWith({
        tabId: 30,
        popup: 'pwa-popup.html',
      });
      expect(mockAction.setPopup).toHaveBeenCalledWith({
        popup: 'pwa-popup.html',
      });
    });
  });
});
