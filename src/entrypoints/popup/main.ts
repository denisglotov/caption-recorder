import { DraftStorageService } from '../../services/DraftStorageService';
import {
  exportToMarkdown,
  exportToSrt,
  exportToTxt,
  exportToVtt,
  triggerDownload,
} from '../../core/exporters';
import type { MeetingSession } from '../../core/types';
import { t } from '../../i18n';

async function initPopup() {
  localizeUI();
  await checkUnsavedDraft();
  checkAIStatus();
}

function localizeUI() {
  const setTxt = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setTxt('txt-recovery-title', t('recovery.title'));
  setTxt('txt-recovery-desc', t('recovery.description'));
  setTxt('lbl-recorded-at', `${t('recovery.recordedAt')}:`);
  setTxt('lbl-duration', `${t('recovery.duration')}:`);
  setTxt('lbl-speakers', `${t('recovery.speakers')}:`);
  setTxt('btn-save-draft', t('recovery.download'));
  setTxt('btn-discard-draft', t('recovery.discard'));
}

async function checkUnsavedDraft() {
  const draft = await DraftStorageService.getUnsavedDraft();
  const secRecovery = document.getElementById('sec-recovery');
  const secIdle = document.getElementById('sec-idle');

  if (!draft || !draft.segments || draft.segments.length === 0) {
    if (secRecovery) secRecovery.style.display = 'none';
    if (secIdle) secIdle.style.display = 'block';
    return;
  }

  // Show recovery section
  if (secRecovery) secRecovery.style.display = 'block';
  if (secIdle) secIdle.style.display = 'none';

  // Format details
  const dateStr = new Date(draft.startTime).toLocaleString();
  const durationMs = (draft.endTime || Date.now()) - draft.startTime;
  const durationSec = Math.floor(durationMs / 1000);
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  const durationStr = `${m}m ${s}s`;

  const speakers = Array.from(new Set(draft.segments.map((s) => s.speaker)));

  const valDate = document.getElementById('val-recorded-at');
  if (valDate) valDate.textContent = dateStr;

  const valDur = document.getElementById('val-duration');
  if (valDur) valDur.textContent = durationStr;

  const valSpeakers = document.getElementById('val-speakers');
  if (valSpeakers) valSpeakers.textContent = speakers.join(', ') || '1';

  // Bind Export & Save
  const btnSave = document.getElementById('btn-save-draft');
  btnSave?.replaceWith(btnSave.cloneNode(true)); // Clear listeners
  document.getElementById('btn-save-draft')?.addEventListener('click', async () => {
    await handleExportDraft(draft);
  });

  // Bind Discard
  const btnDiscard = document.getElementById('btn-discard-draft');
  btnDiscard?.replaceWith(btnDiscard.cloneNode(true));
  document.getElementById('btn-discard-draft')?.addEventListener('click', async () => {
    const confirmed = window.confirm(t('recovery.discardConfirm'));
    if (confirmed) {
      await DraftStorageService.clearDraft();
      if (secRecovery) secRecovery.style.display = 'none';
      if (secIdle) secIdle.style.display = 'block';
    }
  });
}

async function handleExportDraft(session: MeetingSession) {
  const select = document.getElementById('sel-export-fmt') as HTMLSelectElement;
  const fmt = select ? select.value : 'md';

  const dateStr = new Date(session.startTime).toISOString().slice(0, 10);
  const filenamePrefix = `CaptionRecorder_${(session.title || 'Saved_Meeting').replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}`;

  if (fmt === 'txt') {
    triggerDownload(`${filenamePrefix}.txt`, exportToTxt(session), 'text/plain');
  } else if (fmt === 'srt') {
    triggerDownload(`${filenamePrefix}.srt`, exportToSrt(session), 'application/x-subrip');
  } else if (fmt === 'vtt') {
    triggerDownload(`${filenamePrefix}.vtt`, exportToVtt(session), 'text/vtt');
  } else {
    triggerDownload(`${filenamePrefix}.md`, exportToMarkdown(session), 'text/markdown');
  }

  // Clear draft
  await DraftStorageService.clearDraft();

  const secRecovery = document.getElementById('sec-recovery');
  const secIdle = document.getElementById('sec-idle');
  if (secRecovery) secRecovery.style.display = 'none';
  if (secIdle) secIdle.style.display = 'block';

  const idleTitle = document.getElementById('txt-idle-title');
  if (idleTitle) {
    idleTitle.textContent = t('recovery.saved');
    setTimeout(() => {
      idleTitle.textContent = 'Ready for Meetings';
    }, 3000);
  }
}

function checkAIStatus() {
  const pill = document.getElementById('ai-status-pill');
  if (!pill) return;

  const hasAI = typeof window !== 'undefined' && Boolean(window.ai || window.LanguageModel);
  if (hasAI) {
    pill.className = 'pill pill-ready';
    pill.textContent = 'Supported';
  } else {
    pill.className = 'pill pill-unsupported';
    pill.textContent = 'Chrome only';
  }
}

document.addEventListener('DOMContentLoaded', initPopup);
