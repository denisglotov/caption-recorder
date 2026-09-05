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
  setupCloseButton();
  listenToExtensionMessages();
  listenToStorageChanges();

  await loadInitialSession();
  startDurationTimer();
}

function setupCloseButton() {
  document.getElementById('btn-close-sidepanel')?.addEventListener('click', () => {
    const globalObj = globalThis as unknown as {
      browser?: { sidebarAction?: { close: () => Promise<void> } };
    };
    if (globalObj.browser?.sidebarAction?.close) {
      globalObj.browser.sidebarAction.close().catch(() => {});
    }
    window.close();
  });
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
  setTxt('txt-idle-title', t('idle.title'));
  setTxt('txt-idle-desc', t('idle.desc'));
  setTxt('txt-copy-btn', t('export.copyClipboard'));
  setTxt('txt-discard-btn', t('controls.discardSession'));
  setTxt('lbl-duration', t('metrics.duration'));
  setTxt('lbl-speakers', t('metrics.speakers'));
  setTxt('lbl-words', t('metrics.words'));
  setTxt('lbl-turns', t('metrics.turns'));
  setTxt('txt-export-title', t('export.title'));
  setTxt('txt-export-subheading', t('export.subheading'));

  const btnClose = document.getElementById('btn-close-sidepanel');
  if (btnClose) btnClose.title = t('controls.closePanel');

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
    const meetTab = await getTargetMeetTab();
    if (meetTab?.id) {
      chrome.tabs.sendMessage(meetTab.id, { type: 'CR_RESET_SESSION' }).catch(() => {});
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

async function getTargetMeetTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;

  // 1. Check recording state recorded by background worker
  try {
    const res = await chrome.storage.local.get('caption_recorder_recording_state');
    const tabId = res?.caption_recorder_recording_state?.tabId;
    if (tabId && chrome.tabs.get) {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (tab) return tab;
    }
  } catch {
    // Ignore storage or tab retrieval errors
  }

  // 2. Query active tab in the browser window
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab?.id && activeTab.url && activeTab.url.includes('meet.google.com')) {
      return activeTab;
    }
  } catch {
    // Ignore tab query errors
  }

  // 3. Fallback to any open Google Meet tab
  try {
    const meetTabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    if (meetTabs && meetTabs.length > 0) {
      const active = meetTabs.find((t) => t.active);
      return active || meetTabs[0];
    }
  } catch {
    // Ignore meet tab query errors
  }

  return null;
}

async function loadInitialSession() {
  let storedState: { status?: RecordingStatus; tabId?: number } | undefined;
  let draft: MeetingSession | null = null;

  try {
    const [stateRes, storedDraft] = await Promise.all([
      chrome.storage.local.get('caption_recorder_recording_state'),
      DraftStorageService.getUnsavedDraft(true),
    ]);
    storedState = stateRes?.caption_recorder_recording_state;
    draft = storedDraft;
  } catch (err) {
    console.warn('[SidePanel] Error reading initial storage state', err);
  }

  const isRecording = storedState?.status === 'recording';

  // 1. Query the Google Meet tab directly for live session
  const targetTab = await getTargetMeetTab();
  if (targetTab?.id) {
    try {
      const response = await chrome.tabs
        .sendMessage(targetTab.id, { type: 'CR_GET_STATUS' })
        .catch(() => null);

      if (response && response.session) {
        currentSession = response.session;
        currentStatus = response.status || (isRecording ? 'recording' : 'idle');
        activeDraft = response.activeDraft || null;
        updateStatus(currentStatus);
        renderTranscript(true);
        updateMetrics();
        return;
      }
    } catch {
      // Content script may not be ready
    }
  }

  // 2. Fall back to draft in storage
  if (draft) {
    currentSession = draft;
    const initialStatus = isRecording ? 'recording' : draft.endTime ? 'idle' : 'paused';
    updateStatus(initialStatus);
    renderTranscript(true);
    updateMetrics();

    if (draft.endTime) {
      showRecoveryBanner(draft);
    }
    return;
  }

  // 3. Default state
  updateStatus(isRecording ? 'recording' : 'idle');
  renderTranscript(true);
  updateMetrics();
}

function updateStatus(status: RecordingStatus) {
  currentStatus = status;
  const pill = document.getElementById('status-pill');
  const label = document.getElementById('status-text');
  if (!pill || !label) return;

  pill.className = `status-pill status-${status}`;
  if (status === 'recording') {
    label.textContent = t('status.recording');
  } else if (status === 'paused') {
    label.textContent = t('status.paused');
  } else {
    label.textContent = t('status.idle');
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
    if (currentStatus === 'recording') {
      listEl.innerHTML = `
        <div id="empty-state" class="empty-state">
          <div class="empty-icon" style="background: rgba(239, 68, 68, 0.1);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h3 class="empty-title">${escapeHtml(t('live.recordingTitle'))}</h3>
          <p class="empty-desc">
            ${escapeHtml(t('live.recordingDesc'))}
          </p>
        </div>
      `;
    } else {
      listEl.innerHTML = `
        <div id="empty-state" class="empty-state">
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.75">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 id="txt-idle-title" class="empty-title">${escapeHtml(t('idle.title'))}</h3>
          <p id="txt-idle-desc" class="empty-desc">${escapeHtml(t('idle.desc'))}</p>
        </div>
      `;
    }
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
      renderTranscript();
      updateMetrics();
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
    } else if (msg.type === 'CR_UPDATE_TURN' && msg.segment) {
      if (!currentSession) {
        currentSession = {
          id: `session_${Date.now()}`,
          title: 'Google Meet',
          startTime: msg.segment.startTime,
          segments: [msg.segment],
          platform: 'google-meet',
        };
      } else {
        const idx = currentSession.segments.findIndex((s) => s.id === msg.segment!.id);
        if (idx >= 0) {
          currentSession.segments[idx] = msg.segment;
        } else {
          currentSession.segments.push(msg.segment);
        }
      }
      renderTranscript();
      updateMetrics();
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
    if (areaName !== 'local') return;

    if (changes['caption_recorder_recording_state']) {
      const newState = changes['caption_recorder_recording_state'].newValue as
        { status?: RecordingStatus; tabId?: number } | undefined;
      if (newState?.status) {
        updateStatus(newState.status);
        renderTranscript();
      }
    }

    if (changes['caption_recorder_unsaved_draft']) {
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
      } else {
        currentSession = newDraft;
        renderTranscript();
        updateMetrics();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initSidePanel);
