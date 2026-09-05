import { t } from '../../i18n';
import type { RecordingStatus } from '../../core/types';

export function localizeUI(): void {
  const setTxt = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setTxt('pwa-title', t('pwaNotice.title'));
  setTxt('pwa-desc', t('pwaNotice.desc'));
  setTxt('btn-dismiss-pwa', t('pwaNotice.close'));
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
    console.warn('[PwaPopup] Error updating status', err);
  }
}

export function setupListeners(): void {
  document.getElementById('btn-dismiss-pwa')?.addEventListener('click', () => {
    window.close();
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
}

if (typeof document !== 'undefined') {
  initPopup().catch((err) => {
    console.warn('[PwaPopup] Init error', err);
  });
}
