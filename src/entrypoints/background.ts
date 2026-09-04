import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.info('[CaptionRecorder] Background service worker initialized');

  // Configure Chrome Side Panel to open when clicking the toolbar action icon
  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[CaptionRecorder] Failed to set side panel behavior:', err);
    });
  }

  // Listen for recording status changes from content scripts to update toolbar badge
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!message || typeof message !== 'object') return;

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
      }
    });
  }
});
