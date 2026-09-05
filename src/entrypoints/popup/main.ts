import { t } from '../../i18n';
import type { RecordingStatus } from '../../core/types';

export function localizeUI(): void {
  const setTxt = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setTxt('pwa-title', t('pwaNotice.title'));
  setTxt('pwa-desc', t('pwaNotice.desc'));
}

export async function updateStatus(): Promise<void> {
  try {
    const res = await chrome.storage.local.get('caption_recorder_recording_state');
    const status: RecordingStatus = res?.caption_recorder_recording_state?.status || 'idle';

    const pill = document.getElementById('status-pill');
    const label = document.getElementById('status-text');

    if (pill && label) {
      if (status === 'recording') {
        pill.className = 'status-pill status-recording';
        label.textContent = t('status.recording');
      } else {
        pill.className = 'status-pill status-idle';
        label.textContent = t('status.idle');
      }
    }
  } catch (err) {
    console.warn('[Popup] Error updating status', err);
  }
}

export async function checkWindowMode(): Promise<void> {
  const viewPwa = document.getElementById('view-pwa');
  const viewNormal = document.getElementById('view-normal');

  try {
    let win: chrome.windows.Window | null = null;
    if (typeof chrome !== 'undefined' && chrome.windows?.getLastFocused) {
      try {
        win = await chrome.windows.getLastFocused();
      } catch (err) {
        console.warn('[Popup] getLastFocused error', err);
      }
    }

    if (!win && typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const tabs =
        (await chrome.tabs.query({ active: true, lastFocusedWindow: true })) ||
        (await chrome.tabs.query({ active: true, currentWindow: true }));
      const activeTab = tabs[0];
      if (activeTab?.windowId != null && chrome.windows?.get) {
        win = await chrome.windows.get(activeTab.windowId);
      }
    }

    // Chrome Side Panel is ONLY supported in 'normal' browser windows.
    // In PWA / Chrome app windows (and standalone popup windows), win.type is 'app' or 'popup'.
    if (win && win.type !== 'normal') {
      if (viewPwa) viewPwa.style.display = 'flex';
      if (viewNormal) viewNormal.style.display = 'none';
      return;
    }
  } catch (err) {
    console.warn('[Popup] Error checking window type', err);
  }

  // Normal browser mode
  if (viewPwa) viewPwa.style.display = 'none';
  if (viewNormal) viewNormal.style.display = 'flex';
}

export function setupListeners(): void {
  document.getElementById('btn-open-sidepanel')?.addEventListener('click', async () => {
    try {
      let windowId: number | undefined;
      if (typeof chrome !== 'undefined' && chrome.windows?.getLastFocused) {
        const win = await chrome.windows.getLastFocused();
        windowId = win?.id;
      }
      if (windowId == null && typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const tabs =
          (await chrome.tabs.query({ active: true, lastFocusedWindow: true })) ||
          (await chrome.tabs.query({ active: true, currentWindow: true }));
        windowId = tabs[0]?.windowId;
      }
      if (windowId != null && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId });
        window.close();
      }
    } catch (err) {
      console.warn('[Popup] Error opening side panel', err);
    }
  });

  // Listen to storage changes for real-time status update
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes['caption_recorder_recording_state']) {
      updateStatus().catch(() => {});
    }
  });
}

export async function initPopup(): Promise<void> {
  localizeUI();
  setupListeners();
  await updateStatus();
  await checkWindowMode();
}

if (typeof document !== 'undefined') {
  initPopup().catch((err) => {
    console.warn('[Popup] Init error', err);
  });
}
