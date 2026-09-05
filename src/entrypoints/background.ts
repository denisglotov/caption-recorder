import { defineBackground } from 'wxt/sandbox';

export interface ActionApi {
  onClicked?: {
    addListener: (callback: (tab: chrome.tabs.Tab) => void) => void;
    removeListener?: (callback: (tab: chrome.tabs.Tab) => void) => void;
    hasListener?: (callback: (tab: chrome.tabs.Tab) => boolean) => boolean;
  };
  setPopup?: (details: { tabId?: number; popup: string }) => Promise<void> | void;
  setBadgeText?: (details: { tabId?: number; text: string }) => Promise<void> | void;
  setBadgeBackgroundColor?: (details: {
    tabId?: number;
    color: string | [number, number, number, number];
  }) => Promise<void> | void;
  setBadgeTextColor?: (details: { tabId?: number; color: string }) => Promise<void> | void;
}

export function getActionApi(): ActionApi | undefined {
  const g = globalThis as unknown as {
    chrome?: {
      action?: ActionApi;
      browserAction?: ActionApi;
    };
    browser?: {
      action?: ActionApi;
      browserAction?: ActionApi;
    };
  };

  return (
    g.chrome?.action ||
    g.browser?.action ||
    g.browser?.browserAction ||
    g.chrome?.browserAction ||
    undefined
  );
}

export function getSidebarActionApi():
  | {
      open?: () => Promise<void>;
      toggle?: () => Promise<void>;
      close?: () => Promise<void>;
    }
  | undefined {
  const g = globalThis as unknown as {
    browser?: {
      sidebarAction?: {
        open?: () => Promise<void>;
        toggle?: () => Promise<void>;
        close?: () => Promise<void>;
      };
    };
  };
  return g.browser?.sidebarAction;
}

export async function updateActionBadge(status: string, tabId?: number): Promise<void> {
  const action = getActionApi();
  if (!action) return;

  if (status === 'recording') {
    if (action.setBadgeText) {
      await action.setBadgeText({ text: 'REC', tabId });
    }
    if (action.setBadgeBackgroundColor) {
      await action.setBadgeBackgroundColor({ color: '#EF4444', tabId });
    }
    if (typeof action.setBadgeTextColor === 'function') {
      try {
        await action.setBadgeTextColor({ color: '#FFFFFF', tabId });
      } catch {
        // setBadgeTextColor may not be supported in all browsers
      }
    }
  } else {
    if (action.setBadgeText) {
      await action.setBadgeText({ text: '', tabId });
    }
  }
}

export async function syncWindowActionBehavior(windowId?: number): Promise<void> {
  const action = getActionApi();
  if (!action?.setPopup) return;
  try {
    let targetWinId = windowId;
    if (
      targetWinId == null ||
      (typeof chrome.windows !== 'undefined' && targetWinId === chrome.windows.WINDOW_ID_NONE)
    ) {
      if (chrome.windows?.getLastFocused) {
        try {
          const focused = await chrome.windows.getLastFocused();
          targetWinId = focused?.id;
        } catch {
          // Ignore
        }
      }
    }

    if (targetWinId == null || !chrome.windows?.get) return;

    let win: chrome.windows.Window | null = null;
    try {
      win = await chrome.windows.get(targetWinId, { populate: true });
    } catch {
      return;
    }

    if (!win) return;

    const isAppWindow = win.type != null && win.type !== 'normal';

    if (isAppWindow) {
      await action.setPopup({ popup: 'pwa-popup.html' });
      if (win.tabs) {
        for (const t of win.tabs) {
          if (t.id != null) {
            await action.setPopup({ tabId: t.id, popup: 'pwa-popup.html' });
          }
        }
      }
    } else {
      await action.setPopup({ popup: '' });
      if (win.tabs) {
        for (const t of win.tabs) {
          if (t.id != null) {
            await action.setPopup({ tabId: t.id, popup: '' });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CaptionRecorder] syncWindowActionBehavior error:', err);
  }
}

export async function handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.windowId == null) return;
  try {
    // Firefox sidebar action: toggle open/closed if supported, otherwise open
    const sidebar = getSidebarActionApi();
    if (sidebar) {
      if (sidebar.toggle) {
        await sidebar.toggle();
        return;
      }
      if (sidebar.open) {
        await sidebar.open();
        return;
      }
    }

    // Standard Chrome: open side panel directly with the user gesture
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.warn('[CaptionRecorder] Side panel failed to open:', err);
    if (tab.id != null) {
      const action = getActionApi();
      if (action?.setPopup) {
        await action.setPopup({ tabId: tab.id, popup: 'pwa-popup.html' });
        await action.setPopup({ popup: 'pwa-popup.html' });
      }
    }
  }
}

export default defineBackground(() => {
  console.info('[CaptionRecorder] Background service worker initialized');

  // Disable openPanelOnActionClick so Chrome does not intercept action clicks,
  // allowing pwa-popup.html to open in PWA tabs, and handleActionClick to open side panel in regular tabs.
  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err) => {
      console.warn('[CaptionRecorder] Failed to set side panel behavior:', err);
    });
  }

  // Handle action clicks for standard browser tabs (supports Chrome action and Firefox browserAction)
  const action = getActionApi();
  if (action?.onClicked) {
    action.onClicked.addListener(handleActionClick);
  }

  // Sync action popup behavior on window focus changes
  if (typeof chrome !== 'undefined' && chrome.windows?.onFocusChanged) {
    chrome.windows.onFocusChanged.addListener((winId) => {
      if (winId !== chrome.windows.WINDOW_ID_NONE) {
        syncWindowActionBehavior(winId).catch(() => {});
      }
    });
  }

  // Sync on tab activation
  if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      syncWindowActionBehavior(activeInfo.windowId).catch(() => {});
    });
  }

  // Initialize all existing windows on startup
  if (typeof chrome !== 'undefined' && chrome.windows?.getAll) {
    chrome.windows
      .getAll({ populate: true })
      .then((windows) => {
        for (const w of windows) {
          if (w.id != null) {
            syncWindowActionBehavior(w.id).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  // Listen for messages from content scripts
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;

      // PWA detection from content script
      if (message.type === 'CR_SET_PWA_MODE' && sender.tab?.id != null) {
        const actionApi = getActionApi();
        if (actionApi?.setPopup) {
          actionApi.setPopup({ tabId: sender.tab.id, popup: 'pwa-popup.html' });
          actionApi.setPopup({ popup: 'pwa-popup.html' });
        }
      }

      if (message.type === 'CR_STATUS_CHANGE' && sender.tab?.id != null) {
        const tabId = sender.tab.id;
        const status = message.status;

        updateActionBadge(status, tabId).catch(() => {});

        // Store active recording state in storage for side panel instant sync
        chrome.storage.local.set({
          caption_recorder_recording_state: {
            status,
            tabId,
            updatedAt: Date.now(),
          },
        });
      }

      if (message.type === 'CR_GET_ACTIVE_STATUS') {
        chrome.storage.local.get('caption_recorder_recording_state').then((res) => {
          sendResponse(res?.caption_recorder_recording_state || { status: 'idle' });
        });
        return true;
      }
    });
  }

  // Clean up recording state when tab is closed
  if (typeof chrome !== 'undefined' && chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener((closedTabId) => {
      chrome.storage.local.get('caption_recorder_recording_state').then((res) => {
        if (res?.caption_recorder_recording_state?.tabId === closedTabId) {
          chrome.storage.local.set({
            caption_recorder_recording_state: {
              status: 'idle',
              tabId: null,
              updatedAt: Date.now(),
            },
          });
        }
      });
    });
  }
});
