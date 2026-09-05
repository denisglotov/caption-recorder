import { defineBackground } from 'wxt/sandbox';

export async function syncWindowActionBehavior(windowId?: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.action?.setPopup) return;
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
      await chrome.action.setPopup({ popup: 'pwa-popup.html' });
      if (win.tabs) {
        for (const t of win.tabs) {
          if (t.id != null) {
            await chrome.action.setPopup({ tabId: t.id, popup: 'pwa-popup.html' });
          }
        }
      }
    } else {
      await chrome.action.setPopup({ popup: '' });
      if (win.tabs) {
        for (const t of win.tabs) {
          if (t.id != null) {
            await chrome.action.setPopup({ tabId: t.id, popup: '' });
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
    // Firefox sidebar action
    const globalObj = globalThis as unknown as {
      browser?: { sidebarAction?: { open: () => Promise<void> } };
    };
    if (globalObj.browser?.sidebarAction?.open) {
      await globalObj.browser.sidebarAction.open();
      return;
    }

    // Standard Chrome: open side panel directly with the user gesture
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.warn('[CaptionRecorder] Side panel failed to open:', err);
    if (tab.id != null) {
      await chrome.action.setPopup({ tabId: tab.id, popup: 'pwa-popup.html' });
      await chrome.action.setPopup({ popup: 'pwa-popup.html' });
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

  // Handle action clicks for standard browser tabs
  if (typeof chrome !== 'undefined' && chrome.action?.onClicked) {
    chrome.action.onClicked.addListener(handleActionClick);
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
        chrome.action.setPopup({ tabId: sender.tab.id, popup: 'pwa-popup.html' });
        chrome.action.setPopup({ popup: 'pwa-popup.html' });
      }

      if (message.type === 'CR_STATUS_CHANGE' && sender.tab?.id != null) {
        const tabId = sender.tab.id;
        const status = message.status;

        if (status === 'recording') {
          chrome.action.setBadgeText({ text: 'REC', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#EF4444', tabId });
          if ('setBadgeTextColor' in chrome.action) {
            (
              chrome.action as unknown as {
                setBadgeTextColor: (opt: { color: string; tabId?: number }) => void;
              }
            ).setBadgeTextColor({
              color: '#FFFFFF',
              tabId,
            });
          }
        } else {
          chrome.action.setBadgeText({ text: '', tabId });
        }

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
