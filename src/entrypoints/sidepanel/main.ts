import { DraftStorageService } from '../../services/DraftStorageService';
import { downloadExport, exportToTxt, copyToClipboard } from '../../core/exporters';
import type {
  ExportFormat,
  InterimCaption,
  MeetingSession,
  RecordingStatus,
  TranscriptSegment,
} from '../../core/types';
import { t } from '../../i18n';

let currentSession: MeetingSession | null = null;
let currentStatus: RecordingStatus = 'idle';
let activeDraft: InterimCaption | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

function countWords(text?: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (segmenter) {
    let count = 0;
    for (const seg of segmenter.segment(trimmed)) {
      if (seg.isWordLike) count++;
    }
    return count;
  }
  return trimmed.split(/\s+/).length;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatElapsed(timeDiffMs: number): string {
  const totalSec = Math.max(0, Math.floor(timeDiffMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatDuration(timeDiffMs: number): string {
  const totalSec = Math.max(0, Math.floor(timeDiffMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

async function initSidePanel() {
  localizeUI();
  setupNavigation();
  setupExportButtons();
  setupSessionControls();
  listenToExtensionMessages();
  listenToStorageChanges();

  await loadInitialSession();
  startDurationTimer();
}

function localizeUI() {
  const setTxt = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setTxt('txt-recovery-title', t('recovery.title'));
  setTxt('txt-recovery-desc', t('recovery.description'));
  setTxt('btn-rec-export', t('tabs.export'));
  setTxt('btn-rec-discard', t('recovery.discard'));
  setTxt('tab-label-live', t('tabs.live'));
  setTxt('tab-label-export', t('tabs.export'));
  setTxt('btn-label-new-meeting', t('controls.newSession'));
  setTxt('txt-idle-title', t('popup.idleTitle'));
  setTxt('txt-idle-desc', t('popup.idleDesc'));
  setTxt('txt-copy-btn', t('export.copyClipboard'));
  setTxt('txt-discard-btn', t('controls.newSession'));

  const manifest =
    typeof chrome !== 'undefined' && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest()
      : null;
  if (manifest?.version) {
    setTxt('brand-version', `v${manifest.version}`);
  }
}

function setupNavigation() {
  const tabLive = document.getElementById('tab-btn-live');
  const tabExport = document.getElementById('tab-btn-export');
  const paneLive = document.getElementById('pane-live');
  const paneExport = document.getElementById('pane-export');

  const switchTab = (tab: 'live' | 'export') => {
    tabLive?.classList.toggle('active', tab === 'live');
    tabExport?.classList.toggle('active', tab === 'export');

    if (paneLive) paneLive.style.display = tab === 'live' ? 'block' : 'none';
    if (paneExport) paneExport.style.display = tab === 'export' ? 'block' : 'none';
  };

  tabLive?.addEventListener('click', () => switchTab('live'));
  tabExport?.addEventListener('click', () => switchTab('export'));

  document.getElementById('btn-rec-export')?.addEventListener('click', () => {
    switchTab('export');
  });
}

function setupExportButtons() {
  const formats: ExportFormat[] = ['md', 'txt', 'srt', 'vtt'];

  formats.forEach((fmt) => {
    document.getElementById(`btn-exp-${fmt}`)?.addEventListener('click', () => {
      if (currentSession && currentSession.segments.length > 0) {
        downloadExport(currentSession, fmt);
      }
    });
  });

  const btnCopy = document.getElementById('btn-copy-all');
  btnCopy?.addEventListener('click', async () => {
    if (!currentSession || currentSession.segments.length === 0) return;
    const success = await copyToClipboard(exportToTxt(currentSession));
    if (success) {
      const txtEl = document.getElementById('txt-copy-btn');
      if (txtEl) {
        const originalText = txtEl.textContent;
        txtEl.textContent = t('export.copied');
        setTimeout(() => {
          txtEl.textContent = originalText;
        }, 2000);
      }
    }
  });
}

function setupSessionControls() {
  const handleDiscard = async () => {
    if (currentSession && currentSession.segments.length > 0) {
      const confirmed = window.confirm(t('recovery.discardConfirm'));
      if (!confirmed) return;
    }

    await DraftStorageService.clearDraft();

    // Notify content script to reset session if running
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'CR_RESET_SESSION' }).catch(() => {});
        }
      });
    }

    currentSession = null;
    activeDraft = null;
    updateStatus('idle');
    renderTranscript();
    updateMetrics();
    hideRecoveryBanner();
  };

  document.getElementById('btn-new-meeting')?.addEventListener('click', handleDiscard);
  document.getElementById('btn-reset-session')?.addEventListener('click', handleDiscard);
  document.getElementById('btn-rec-discard')?.addEventListener('click', handleDiscard);
}

async function loadInitialSession() {
  // 1. Try to query the active tab's SessionRecorder first
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        const response = await chrome.tabs
          .sendMessage(activeTab.id, { type: 'CR_GET_STATUS' })
          .catch(() => null);

        if (response && response.session) {
          currentSession = response.session;
          currentStatus = response.status || 'idle';
          activeDraft = response.activeDraft || null;
          updateStatus(currentStatus);
          renderTranscript(true);
          updateMetrics();
          return;
        }
      }
    } catch {
      // Content script may not be running in this tab
    }
  }

  // 2. Fall back to unsaved draft in storage
  const draft = await DraftStorageService.getUnsavedDraft();
  if (draft && Array.isArray(draft.segments) && draft.segments.length > 0) {
    currentSession = draft;
    updateStatus(draft.endTime ? 'idle' : 'paused');
    renderTranscript(true);
    updateMetrics();

    if (draft.endTime) {
      showRecoveryBanner(draft);
    }
  } else {
    updateStatus('idle');
    renderTranscript(true);
    updateMetrics();
  }
}

function updateStatus(status: RecordingStatus) {
  currentStatus = status;
  const pill = document.getElementById('status-pill');
  const label = document.getElementById('status-text');
  if (!pill || !label) return;

  pill.className = `status-pill status-${status}`;
  if (status === 'recording') {
    label.textContent = 'Recording';
  } else if (status === 'paused') {
    label.textContent = 'Paused';
  } else {
    label.textContent = 'Idle';
  }

  const btnNew = document.getElementById('btn-new-meeting');
  const btnReset = document.getElementById('btn-reset-session');
  const hasSegments = Boolean(currentSession && currentSession.segments.length > 0);
  if (btnNew) btnNew.style.display = hasSegments ? 'inline-flex' : 'none';
  if (btnReset) btnReset.style.display = hasSegments ? 'inline-flex' : 'none';
}

function renderTranscript(forceScroll: boolean = false) {
  const listEl = document.getElementById('transcript-list');
  if (!listEl) return;

  const segments = currentSession?.segments || [];
  const hasActive = Boolean(activeDraft && currentStatus === 'recording');

  if (segments.length === 0 && !hasActive) {
    listEl.innerHTML = `
      <div id="empty-state" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.75">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 id="txt-idle-title" class="empty-title">${t('popup.idleTitle')}</h3>
        <p id="txt-idle-desc" class="empty-desc">${t('popup.idleDesc')}</p>
      </div>
    `;
    return;
  }

  const baseTime = currentSession?.startTime || Date.now();

  const segmentsHtml = segments
    .map((seg) => {
      const timeStr = formatElapsed(seg.startTime - baseTime);
      return `
        <div class="cr-turn">
          <div class="cr-turn-header">
            <span class="cr-speaker-badge">${escapeHtml(seg.speaker)}</span>
            <span class="cr-timestamp">${timeStr}</span>
          </div>
          <div class="cr-turn-text">${escapeHtml(seg.text)}</div>
        </div>
      `;
    })
    .join('');

  let activeHtml = '';
  if (hasActive && activeDraft) {
    const timeStr = formatElapsed((activeDraft.timestamp || Date.now()) - baseTime);
    activeHtml = `
      <div class="cr-turn cr-active-turn" id="active-draft-turn">
        <div class="cr-turn-header">
          <span class="cr-speaker-badge">${escapeHtml(activeDraft.speaker)}</span>
          <span class="cr-timestamp">${timeStr}</span>
        </div>
        <div class="cr-turn-text">${escapeHtml(activeDraft.text)}</div>
      </div>
    `;
  }

  const wasNearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;

  listEl.innerHTML = segmentsHtml + activeHtml;

  if (forceScroll || wasNearBottom) {
    listEl.scrollTop = listEl.scrollHeight;
  }
}

function updateMetrics() {
  const segments = currentSession?.segments || [];
  const baseTime = currentSession?.startTime || Date.now();
  const endTime = currentSession?.endTime || Date.now();

  const durationMs = currentSession ? Math.max(0, endTime - baseTime) : 0;
  const durationStr = formatDuration(durationMs);

  const speakers = Array.from(new Set(segments.map((s) => s.speaker))).length;
  let wordCount = segments.reduce((acc, seg) => acc + countWords(seg.text), 0);
  let turnsCount = segments.length;

  if (activeDraft && currentStatus === 'recording') {
    wordCount += countWords(activeDraft.text);
    turnsCount += 1;
  }

  const valDur = document.getElementById('val-duration');
  if (valDur) valDur.textContent = durationStr;

  const valSpk = document.getElementById('val-speakers');
  if (valSpk) valSpk.textContent = speakers.toString();

  const valWords = document.getElementById('val-words');
  if (valWords) valWords.textContent = wordCount.toString();

  const valTurns = document.getElementById('val-turns');
  if (valTurns) valTurns.textContent = turnsCount.toString();

  const btnNew = document.getElementById('btn-new-meeting');
  const btnReset = document.getElementById('btn-reset-session');
  const hasSegments = segments.length > 0;
  if (btnNew) btnNew.style.display = hasSegments ? 'inline-flex' : 'none';
  if (btnReset) btnReset.style.display = hasSegments ? 'inline-flex' : 'none';
}

function startDurationTimer() {
  if (durationInterval) clearInterval(durationInterval);

  durationInterval = setInterval(() => {
    if (currentStatus === 'recording' && currentSession) {
      updateMetrics();
    }
  }, 1000);
}

function showRecoveryBanner(draft: MeetingSession) {
  const banner = document.getElementById('sec-recovery');
  const desc = document.getElementById('txt-recovery-desc');
  if (!banner) return;

  banner.style.display = 'flex';
  if (desc) {
    const durationSec = Math.max(
      0,
      Math.floor(((draft.endTime || draft.savedAt || Date.now()) - draft.startTime) / 1000)
    );
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    const speakers = Array.from(new Set(draft.segments.map((seg) => seg.speaker))).length;
    desc.textContent = `${draft.segments.length} turns • ${m}m ${s}s • ${speakers} speaker${speakers === 1 ? '' : 's'}`;
  }
}

function hideRecoveryBanner() {
  const banner = document.getElementById('sec-recovery');
  if (banner) banner.style.display = 'none';
}

function listenToExtensionMessages() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;
    const msg = message as {
      type?: string;
      status?: RecordingStatus;
      segment?: TranscriptSegment;
      caption?: InterimCaption | null;
    };

    if (msg.type === 'CR_STATUS_CHANGE' && msg.status) {
      updateStatus(msg.status);
      if (msg.status === 'recording') {
        hideRecoveryBanner();
      }
    } else if (msg.type === 'CR_NEW_TURN' && msg.segment) {
      if (!currentSession) {
        currentSession = {
          id: `session_${Date.now()}`,
          title: 'Google Meet',
          startTime: msg.segment.startTime,
          segments: [],
          platform: 'google-meet',
        };
      }
      currentSession.segments.push(msg.segment);
      activeDraft = null;
      renderTranscript();
      updateMetrics();
      hideRecoveryBanner();
    } else if (msg.type === 'CR_ACTIVE_CAPTION') {
      activeDraft = msg.caption || null;
      renderTranscript();
      updateMetrics();
    }
  });
}

function listenToStorageChanges() {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['caption_recorder_unsaved_draft']) {
      const newDraft = changes['caption_recorder_unsaved_draft'].newValue as
        MeetingSession | undefined;
      if (!newDraft) {
        if (currentStatus !== 'recording') {
          currentSession = null;
          activeDraft = null;
          updateStatus('idle');
          renderTranscript();
          updateMetrics();
          hideRecoveryBanner();
        }
      } else if (currentStatus !== 'recording') {
        currentSession = newDraft;
        renderTranscript();
        updateMetrics();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initSidePanel);
