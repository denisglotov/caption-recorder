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
import { browser } from 'wxt/browser';

export let currentSession: MeetingSession | null = null;
export let currentStatus: RecordingStatus = 'idle';
export let activeDraft: InterimCaption | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;

let cachedWordsCount = 0;
const cachedSpeakersSet = new Set<string>();

export function recalculateCachedMetrics(): void {
  cachedWordsCount = 0;
  cachedSpeakersSet.clear();
  const segments = currentSession?.segments || [];
  for (const seg of segments) {
    cachedWordsCount += countWords(seg.text);
    if (seg.speaker) cachedSpeakersSet.add(seg.speaker);
  }
}

export function setCurrentSession(session: MeetingSession | null): void {
  currentSession = session;
  recalculateCachedMetrics();
}

export function setCurrentStatus(status: RecordingStatus): void {
  currentStatus = status;
}

export function setActiveDraft(draft: InterimCaption | null): void {
  activeDraft = draft;
}

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

export function countWords(text?: string): number {
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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatElapsed(timeDiffMs: number): string {
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

export function formatDuration(timeDiffMs: number): string {
  const totalSec = Math.max(0, Math.floor(timeDiffMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export async function initSidePanel() {
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

export function setupCloseButton() {
  const btnClose = document.getElementById('btn-close-sidepanel');
  if (!btnClose) return;

  const sidebar = (browser as unknown as { sidebarAction?: { close?: () => Promise<void> } })
    .sidebarAction;

  if (!sidebar && 'sidePanel' in browser && Reflect.get(browser, 'sidePanel')) {
    btnClose.style.display = 'none';
    return;
  }

  btnClose.addEventListener('click', () => {
    if (sidebar?.close) {
      sidebar.close().catch(() => {});
    }
    window.close();
  });
}

export function localizeUI() {
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
  setTxt('txt-sponsor-btn', t('export.sponsorGithub'));

  const btnSponsor = document.getElementById('btn-sponsor-github');
  if (btnSponsor) btnSponsor.title = t('export.sponsorGithub');

  const btnClose = document.getElementById('btn-close-sidepanel');
  if (btnClose) btnClose.title = t('controls.closePanel');

  const manifest = browser.runtime?.getManifest?.();
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

export function setupExportButtons() {
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

  const btnSponsor = document.getElementById('btn-sponsor-github');
  btnSponsor?.addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'https://github.com/sponsors/denisglotov' });
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
      browser.tabs.sendMessage(meetTab.id, { type: 'CR_RESET_SESSION' }).catch(() => {});
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

async function getTargetMeetTab(): Promise<import('wxt/browser').Tabs.Tab | null> {
  // 1. Check recording state recorded by background worker
  try {
    const res = await browser.storage.local.get('caption_recorder_recording_state');
    const tabId = (res as { caption_recorder_recording_state?: { tabId?: number } })
      ?.caption_recorder_recording_state?.tabId;
    if (tabId && browser.tabs.get) {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (tab) return tab;
    }
  } catch {
    // Ignore storage or tab retrieval errors
  }

  // 2. Query active tab in the browser window
  try {
    const [activeTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab?.id && activeTab.url && activeTab.url.includes('meet.google.com')) {
      return activeTab;
    }
  } catch {
    // Ignore tab query errors
  }

  // 3. Fallback to any open Google Meet tab
  try {
    const meetTabs = await browser.tabs.query({ url: 'https://meet.google.com/*' });
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
      browser.storage.local.get('caption_recorder_recording_state'),
      DraftStorageService.getUnsavedDraft(true),
    ]);
    storedState = (
      stateRes as {
        caption_recorder_recording_state?: {
          status?: RecordingStatus;
          tabId?: number;
        };
      }
    )?.caption_recorder_recording_state;
    draft = storedDraft;
  } catch (err) {
    console.warn('[SidePanel] Error reading initial storage state', err);
  }

  const isRecording = storedState?.status === 'recording';

  // 1. Query the Google Meet tab directly for live session
  const targetTab = await getTargetMeetTab();
  if (targetTab?.id) {
    try {
      const response = await browser.tabs
        .sendMessage(targetTab.id, { type: 'CR_GET_STATUS' })
        ?.catch?.(() => null);

      const statusRes = response as
        | {
            session?: MeetingSession;
            status?: RecordingStatus;
            activeDraft?: InterimCaption;
          }
        | undefined;

      if (statusRes?.session) {
        currentSession = statusRes.session;
        currentStatus = statusRes.status || (isRecording ? 'recording' : 'idle');
        activeDraft = statusRes.activeDraft || null;
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

export function updateStatus(status: RecordingStatus) {
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

export function populateTurnContent(
  turnEl: HTMLElement,
  speaker: string,
  text: string,
  timeStr: string
): void {
  const headerEl = document.createElement('div');
  headerEl.className = 'cr-turn-header';

  const speakerEl = document.createElement('span');
  speakerEl.className = 'cr-speaker-badge';
  speakerEl.textContent = speaker;

  const timeEl = document.createElement('span');
  timeEl.className = 'cr-timestamp';
  timeEl.textContent = timeStr;

  headerEl.appendChild(speakerEl);
  headerEl.appendChild(timeEl);

  const textEl = document.createElement('div');
  textEl.className = 'cr-turn-text';
  textEl.textContent = text;

  turnEl.replaceChildren(headerEl, textEl);
}

export function createTurnElement(
  speaker: string,
  text: string,
  timeStr: string,
  segmentId?: string,
  isActive: boolean = false
): HTMLDivElement {
  const turnEl = document.createElement('div');
  turnEl.className = isActive ? 'cr-turn cr-active-turn' : 'cr-turn';
  if (segmentId) {
    turnEl.setAttribute('data-segment-id', segmentId);
  }
  if (isActive) {
    turnEl.id = 'active-draft-turn';
  }

  populateTurnContent(turnEl, speaker, text, timeStr);
  return turnEl;
}

export function createEmptyStateElement(mode: 'recording' | 'idle'): HTMLDivElement {
  const emptyEl = document.createElement('div');
  emptyEl.id = 'empty-state';
  emptyEl.className = 'empty-state';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'empty-icon';

  const svgNS = 'http://www.w3.org/2000/svg';
  const createSvgEl = (tag: string) =>
    document.createElementNS ? document.createElementNS(svgNS, tag) : document.createElement(tag);

  const svg = createSvgEl('svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');

  if (mode === 'recording') {
    iconContainer.style.background = 'rgba(239, 68, 68, 0.1)';
    svg.setAttribute('stroke', '#ef4444');
    svg.setAttribute('stroke-width', '2');

    const path1 = createSvgEl('path');
    path1.setAttribute('d', 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z');
    const path2 = createSvgEl('path');
    path2.setAttribute('d', 'M19 10v2a7 7 0 0 1-14 0v-2');
    const line = createSvgEl('line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '19');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '22');
    svg.appendChild(path1);
    svg.appendChild(path2);
    svg.appendChild(line);
  } else {
    svg.setAttribute('stroke', '#4f46e5');
    svg.setAttribute('stroke-width', '1.75');

    const path = createSvgEl('path');
    path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    svg.appendChild(path);
  }
  iconContainer.appendChild(svg);

  const titleEl = document.createElement('h3');
  titleEl.className = 'empty-title';
  titleEl.textContent = mode === 'recording' ? t('live.recordingTitle') : t('idle.title');
  if (mode === 'idle') {
    titleEl.id = 'txt-idle-title';
  }

  const descEl = document.createElement('p');
  descEl.className = 'empty-desc';
  descEl.textContent = mode === 'recording' ? t('live.recordingDesc') : t('idle.desc');
  if (mode === 'idle') {
    descEl.id = 'txt-idle-desc';
  }

  emptyEl.appendChild(iconContainer);
  emptyEl.appendChild(titleEl);
  emptyEl.appendChild(descEl);
  return emptyEl;
}

export function updateActiveDraftTurn(caption: InterimCaption | null) {
  const listEl = document.getElementById('transcript-list');
  if (!listEl) return;

  activeDraft = caption;
  const hasActive = Boolean(activeDraft && currentStatus === 'recording');

  if ((!currentSession || currentSession.segments.length === 0) && !hasActive) {
    renderTranscript();
    updateMetrics();
    return;
  }

  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();

  let activeEl = document.getElementById('active-draft-turn');

  if (!hasActive || !activeDraft) {
    if (activeEl) activeEl.remove();
    updateMetrics();
    return;
  }

  const baseTime = currentSession?.startTime || Date.now();
  const timeStr = formatElapsed((activeDraft.timestamp || Date.now()) - baseTime);
  const wasNearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;

  if (!activeEl) {
    activeEl = createTurnElement(activeDraft.speaker, activeDraft.text, timeStr, undefined, true);
    listEl.appendChild(activeEl);
  } else {
    populateTurnContent(activeEl, activeDraft.speaker, activeDraft.text, timeStr);
  }

  if (wasNearBottom) {
    listEl.scrollTop = listEl.scrollHeight;
  }

  updateMetrics();
}

export function appendTurnElement(segment: TranscriptSegment): void {
  const listEl = document.getElementById('transcript-list');
  if (!listEl) return;

  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();

  const activeEl = document.getElementById('active-draft-turn');
  if (activeEl) activeEl.remove();

  const baseTime = currentSession?.startTime || Date.now();
  const timeStr = formatElapsed(segment.startTime - baseTime);
  const wasNearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;

  const turnEl = createTurnElement(segment.speaker, segment.text, timeStr, segment.id);
  listEl.appendChild(turnEl);

  cachedWordsCount += countWords(segment.text);
  if (segment.speaker) cachedSpeakersSet.add(segment.speaker);

  if (wasNearBottom) {
    listEl.scrollTop = listEl.scrollHeight;
  }

  updateMetrics();
}

export function updateTurnElement(segment: TranscriptSegment): void {
  const listEl = document.getElementById('transcript-list');
  if (!listEl) return;

  const turnEl = listEl.querySelector<HTMLElement>(`[data-segment-id="${segment.id}"]`);
  if (turnEl) {
    const baseTime = currentSession?.startTime || Date.now();
    const timeStr = formatElapsed(segment.startTime - baseTime);

    populateTurnContent(turnEl, segment.speaker, segment.text, timeStr);

    recalculateCachedMetrics();
    updateMetrics();
  } else {
    renderTranscript();
    updateMetrics();
  }
}

export function renderTranscript(forceScroll: boolean = false) {
  const listEl = document.getElementById('transcript-list');
  if (!listEl) return;

  recalculateCachedMetrics();

  const segments = currentSession?.segments || [];
  const hasActive = Boolean(activeDraft && currentStatus === 'recording');

  if (segments.length === 0 && !hasActive) {
    listEl.replaceChildren(
      createEmptyStateElement(currentStatus === 'recording' ? 'recording' : 'idle')
    );
    return;
  }

  const baseTime = currentSession?.startTime || Date.now();
  const children: HTMLElement[] = [];

  for (const seg of segments) {
    const timeStr = formatElapsed(seg.startTime - baseTime);
    children.push(createTurnElement(seg.speaker, seg.text, timeStr, seg.id));
  }

  if (hasActive && activeDraft) {
    const timeStr = formatElapsed((activeDraft.timestamp || Date.now()) - baseTime);
    children.push(
      createTurnElement(activeDraft.speaker, activeDraft.text, timeStr, undefined, true)
    );
  }

  const wasNearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;

  listEl.replaceChildren(...children);

  if (forceScroll || wasNearBottom) {
    listEl.scrollTop = listEl.scrollHeight;
  }
}

export function updateMetrics() {
  const segments = currentSession?.segments || [];
  const baseTime = currentSession?.startTime || Date.now();
  const endTime = currentSession?.endTime || Date.now();

  const durationMs = currentSession ? Math.max(0, endTime - baseTime) : 0;
  const durationStr = formatDuration(durationMs);

  let speakers = cachedSpeakersSet.size;
  let wordCount = cachedWordsCount;
  let turnsCount = segments.length;

  if (activeDraft && currentStatus === 'recording') {
    wordCount += countWords(activeDraft.text);
    turnsCount += 1;
    if (activeDraft.speaker && !cachedSpeakersSet.has(activeDraft.speaker)) {
      speakers += 1;
    }
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

export function showRecoveryBanner(draft: MeetingSession) {
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

export function hideRecoveryBanner() {
  const banner = document.getElementById('sec-recovery');
  if (banner) banner.style.display = 'none';
}

function listenToExtensionMessages() {
  if (!browser.runtime.onMessage) return;

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const msgEvent = message as {
      type?: string;
      status?: RecordingStatus;
      segment?: TranscriptSegment;
      activeDraft?: InterimCaption;
      caption?: InterimCaption | null;
    };

    if (msgEvent.type === 'CR_STATUS_CHANGE' && msgEvent.status) {
      updateStatus(msgEvent.status);
      if (msgEvent.status === 'recording') {
        hideRecoveryBanner();
      }
      renderTranscript();
      updateMetrics();
    } else if (msgEvent.type === 'CR_NEW_TURN' && msgEvent.segment) {
      if (!currentSession) {
        currentSession = {
          id: `session_${Date.now()}`,
          title: 'Google Meet',
          startTime: msgEvent.segment.startTime,
          segments: [],
          platform: 'google-meet',
        };
      }
      currentSession.segments.push(msgEvent.segment);
      activeDraft = null;
      appendTurnElement(msgEvent.segment);
      hideRecoveryBanner();
    } else if (msgEvent.type === 'CR_UPDATE_TURN' && msgEvent.segment) {
      if (!currentSession) {
        currentSession = {
          id: `session_${Date.now()}`,
          title: 'Google Meet',
          startTime: msgEvent.segment.startTime,
          segments: [msgEvent.segment],
          platform: 'google-meet',
        };
        renderTranscript();
        updateMetrics();
      } else {
        const idx = currentSession.segments.findIndex((s) => s.id === msgEvent.segment!.id);
        if (idx >= 0) {
          currentSession.segments[idx] = msgEvent.segment;
        } else {
          currentSession.segments.push(msgEvent.segment);
        }
        updateTurnElement(msgEvent.segment);
      }
    } else if (msgEvent.type === 'CR_ACTIVE_CAPTION') {
      updateActiveDraftTurn(msgEvent.caption || null);
    }
  });
}

function listenToStorageChanges() {
  if (!browser.storage.onChanged) return;

  browser.storage.onChanged.addListener((changes, areaName) => {
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

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initSidePanel);
}
