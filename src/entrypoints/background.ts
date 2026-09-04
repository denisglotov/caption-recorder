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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
