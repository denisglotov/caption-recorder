import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';

const getAction = () =>
  browser.action || (browser as unknown as { browserAction: typeof browser.action }).browserAction;

export async function updateActionBadge(status: string, tabId?: number): Promise<void> {
  if (status === 'recording') {
    await getAction()?.setBadgeText?.({ text: 'REC', tabId });
    await getAction()?.setBadgeBackgroundColor?.({ color: '#EF4444', tabId });
    try {
      await getAction()?.setBadgeTextColor?.({ color: '#FFFFFF', tabId });
    } catch {
      // setBadgeTextColor may not be supported in all browsers
    }
  } else {
    await getAction()?.setBadgeText?.({ text: '', tabId });
  }
}

export async function syncWindowActionBehavior(windowId?: number): Promise<void> {
  try {
    let targetWinId = windowId;
    if (targetWinId == null || targetWinId === browser.windows.WINDOW_ID_NONE) {
      targetWinId = (await browser.windows.getLastFocused()).id;
    }
    if (targetWinId == null) return;

    const win = await browser.windows.get(targetWinId, { populate: true });
    if (!win) return;

    const isAppWindow = win.type != null && win.type !== 'normal';
    const popup = isAppWindow ? 'pwa-popup.html' : '';

    await getAction()?.setPopup?.({ popup });
    if (win.tabs) {
      for (const t of win.tabs) {
        if (t.id != null) {
          await getAction()?.setPopup?.({ tabId: t.id, popup });
        }
      }
    }
  } catch (err) {
    console.warn('[CaptionRecorder] syncWindowActionBehavior error:', err);
  }
}

export async function handleActionClick(tab: import('wxt/browser').Tabs.Tab): Promise<void> {
  if (tab.windowId == null) return;
  try {
    // Firefox sidebar action: toggle open/closed if supported, otherwise open
    const sidebar = (
      browser as unknown as {
        sidebarAction?: { toggle?: () => Promise<void>; open?: () => Promise<void> };
      }
    ).sidebarAction;
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
    const sidePanel = (
      browser as unknown as {
        sidePanel?: {
          setPanelBehavior?: (opts: { openPanelOnActionClick: boolean }) => Promise<void>;
          open?: (opts: { windowId: number }) => Promise<void>;
        };
      }
    ).sidePanel;
    if (sidePanel?.open) {
      await sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.warn('[CaptionRecorder] Side panel failed to open:', err);
    if (tab.id != null) {
      await getAction()?.setPopup?.({ tabId: tab.id, popup: 'pwa-popup.html' });
      await getAction()?.setPopup?.({ popup: 'pwa-popup.html' });
    }
  }
}

export default defineBackground(() => {
  console.info('[CaptionRecorder] Background service worker initialized');

  // Disable openPanelOnActionClick so Chrome does not intercept action clicks,
  // allowing pwa-popup.html to open in PWA tabs, and handleActionClick to open side panel in regular tabs.
  const sidePanel = (
    browser as unknown as {
      sidePanel?: {
        setPanelBehavior?: (opts: { openPanelOnActionClick: boolean }) => Promise<void>;
        open?: (opts: { windowId: number }) => Promise<void>;
      };
    }
  ).sidePanel;
  if (sidePanel?.setPanelBehavior) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err: unknown) => {
      console.warn('[CaptionRecorder] Failed to set side panel behavior:', err);
    });
  }

  // Handle action clicks for standard browser tabs
  getAction()?.onClicked?.addListener(handleActionClick);

  // Sync action popup behavior on window focus changes
  browser.windows.onFocusChanged.addListener((winId) => {
    if (winId !== browser.windows.WINDOW_ID_NONE) {
      syncWindowActionBehavior(winId).catch(() => {});
    }
  });

  // Sync on tab activation
  browser.tabs.onActivated.addListener((activeInfo) => {
    syncWindowActionBehavior(activeInfo.windowId).catch(() => {});
  });

  // Initialize all existing windows on startup
  browser.windows
    .getAll({ populate: true })
    .then((windows) => {
      for (const w of windows) {
        if (w.id != null) {
          syncWindowActionBehavior(w.id).catch(() => {});
        }
      }
    })
    .catch(() => {});

  // Listen for messages from content scripts
  browser.runtime.onMessage.addListener(
    // @ts-expect-error WXT types restrict return types
    (
      message: unknown,
      sender: import('wxt/browser').Runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (!message || typeof message !== 'object') return;
      const msg = message as { type?: string; status?: string };

      // PWA detection from content script
      if (msg.type === 'CR_SET_PWA_MODE' && sender.tab?.id != null) {
        getAction()?.setPopup?.({ tabId: sender.tab.id, popup: 'pwa-popup.html' });
        getAction()?.setPopup?.({ popup: 'pwa-popup.html' });
      }

      if (msg.type === 'CR_STATUS_CHANGE' && sender.tab?.id != null) {
        const tabId = sender.tab.id;
        const status = msg.status as string;

        updateActionBadge(status, tabId).catch(() => {});

        // Store active recording state in storage for side panel instant sync
        browser.storage.local.set({
          caption_recorder_recording_state: {
            status,
            tabId,
            updatedAt: Date.now(),
          },
        });
      }

      if (msg.type === 'CR_GET_ACTIVE_STATUS') {
        browser.storage.local
          .get('caption_recorder_recording_state')
          .then((res: { caption_recorder_recording_state?: { tabId?: number } }) => {
            sendResponse(res?.caption_recorder_recording_state || { status: 'idle' });
          });
        return true;
      }
    }
  );

  // Clean up recording state when tab is closed
  browser.tabs.onRemoved.addListener((closedTabId) => {
    browser.storage.local
      .get('caption_recorder_recording_state')
      .then((res: { caption_recorder_recording_state?: { tabId?: number } }) => {
        if (res?.caption_recorder_recording_state?.tabId === closedTabId) {
          browser.storage.local.set({
            caption_recorder_recording_state: {
              status: 'idle',
              tabId: null,
              updatedAt: Date.now(),
            },
          });
        }
      });
  });
});
