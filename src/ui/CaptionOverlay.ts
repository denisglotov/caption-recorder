import type { PlatformAdapter } from '../adapters/PlatformAdapter';
import type {
  InterimCaption,
  MeetingSession,
  RecordingStatus,
  TranscriptSegment,
} from '../core/types';
import { downloadExport, exportToTxt, copyToClipboard, type ExportFormat } from '../core/exporters';
import { DraftStorageService } from '../services/DraftStorageService';
import { t } from '../i18n';

export class CaptionOverlay {
  private shadowRoot: ShadowRoot;
  private adapter: PlatformAdapter;

  private status: RecordingStatus = 'idle';
  private session: MeetingSession;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds: number = 0;
  private userManuallyStopped: boolean = false;
  private activeDraft: InterimCaption | null = null;
  private restorePromise: Promise<void> | null = null;
  private cachedSegmentsHtml: string = '';
  private cachedSegmentsCount: number = 0;
  private cachedFinalizedWords: number = 0;
  private cachedSegmentsWordsCount: number = 0;

  // DOM element references
  private widgetEl!: HTMLElement;
  private dotEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private tickerEl!: HTMLElement;
  private btnStart!: HTMLButtonElement;
  private btnPause!: HTMLButtonElement;
  private btnStop!: HTMLButtonElement;
  private btnToggleDrawer!: HTMLButtonElement;
  private nudgeEl!: HTMLElement;

  private drawerEl!: HTMLElement;
  private transcriptListEl!: HTMLElement;
  private wordCountStatEl!: HTMLElement;
  private turnCountStatEl!: HTMLElement;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;

  constructor(shadowRoot: ShadowRoot, adapter: PlatformAdapter) {
    this.shadowRoot = shadowRoot;
    this.adapter = adapter;

    const now = Date.now();
    this.session = {
      id: `session_${now}`,
      title: document.title || 'Google Meet',
      startTime: now,
      segments: [],
      platform: 'google-meet',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.initDOM();
    this.attachEventListeners();
    this.checkCaptionsState();
    this.updateStats();
    this.restorePromise = this.restoreDraftSession();
  }

  private initDOM(): void {
    const container = document.createElement('div');
    container.className = 'cr-container';
    container.innerHTML = `
      <!-- Draggable Floating Widget -->
      <div class="cr-widget" id="cr-widget">
        <div class="cr-dot" id="cr-dot"></div>
        <div class="cr-info">
          <span class="cr-timer" id="cr-timer">00:00:00</span>
          <span class="cr-ticker" id="cr-ticker">${t('nudge.noCaptionsYet')}</span>
        </div>
        <button class="cr-btn-icon cr-btn-rec" id="cr-btn-start" title="${t('controls.start')}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
        </button>
        <button class="cr-btn-icon" id="cr-btn-pause" title="${t('controls.pause')}" style="display:none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
        </button>
        <button class="cr-btn-icon" id="cr-btn-stop" title="${t('controls.stop')}" style="display:none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
        </button>
        <button class="cr-btn-icon" id="cr-btn-drawer" title="${t('controls.openDrawer')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>

      <!-- CC Nudge Banner -->
      <div class="cr-nudge" id="cr-nudge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${t('nudge.ccOff')}</span>
      </div>

      <!-- Expandable Drawer / Modal -->
      <div class="cr-drawer" id="cr-drawer">
        <div class="cr-drawer-header">
          <div class="cr-drawer-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>CaptionRecorder</span>
          </div>
          <div class="cr-drawer-actions">
            <button class="cr-btn-xs" id="cr-btn-new-meeting" title="${t('controls.newSession')}" style="display:none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>${t('controls.newSession')}</span>
            </button>
            <button class="cr-drawer-close" id="cr-drawer-close" title="${t('controls.closeDrawer')}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Recovery Banner -->
        <div class="cr-recovery-banner" id="cr-recovery-banner" style="display:none;">
          <div class="cr-recovery-text">
            <div class="cr-recovery-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              <span>${t('recovery.title')}</span>
            </div>
            <div class="cr-recovery-desc" id="cr-recovery-desc">${t('recovery.description')}</div>
          </div>
          <div class="cr-recovery-actions">
            <button class="cr-btn-xs cr-btn-primary" id="cr-btn-rec-export">${t('tabs.export')}</button>
            <button class="cr-btn-xs cr-btn-danger" id="cr-btn-rec-discard" title="${t('recovery.discard')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="cr-tabs">
          <button class="cr-tab cr-active" data-tab="live">${t('tabs.live')}</button>
          <button class="cr-tab" data-tab="export">${t('tabs.export')}</button>
        </div>

        <!-- Tab 1: Live Transcript -->
        <div class="cr-tab-content" id="cr-tab-live">
          <div class="cr-transcript-list" id="cr-transcript-list">
            <div style="color:#64748b; font-size:12px; text-align:center; padding:20px;">
              ${t('nudge.noCaptionsYet')}
            </div>
          </div>
        </div>

        <!-- Tab 2: Export -->
        <div class="cr-tab-content" id="cr-tab-export" style="display:none;">
          <div class="cr-stats" style="margin-bottom:14px;">
            <div>${t('export.totalWords')}: <span class="cr-stat-val" id="cr-stat-words">0</span></div>
            <div>${t('export.totalTurns')}: <span class="cr-stat-val" id="cr-stat-turns">0</span></div>
          </div>
          <div class="cr-export-grid">
            <button class="cr-export-btn" id="cr-exp-txt">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>TXT</span>
            </button>
            <button class="cr-export-btn" id="cr-exp-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M7 15V9l3 3 3-3v6M18 15l2-3h-4"/></svg>
              <span>Markdown</span>
            </button>
            <button class="cr-export-btn" id="cr-exp-srt">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9v6M14 9v6M6 12h12"/></svg>
              <span>SRT</span>
            </button>
            <button class="cr-export-btn" id="cr-exp-vtt">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m8 10 2 5 2-5M15 10v5"/></svg>
              <span>WebVTT</span>
            </button>
          </div>
          <button class="cr-btn-secondary" id="cr-btn-copy-all" style="width:100%; justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>${t('export.copyClipboard')}</span>
          </button>
          <button class="cr-btn-secondary cr-btn-danger" id="cr-btn-reset-meeting" style="width:100%; justify-content:center; margin-top:8px; display:none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>${t('controls.newSession')}</span>
          </button>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(container);

    // Cache elements
    this.widgetEl = this.shadowRoot.getElementById('cr-widget')!;
    this.dotEl = this.shadowRoot.getElementById('cr-dot')!;
    this.timerEl = this.shadowRoot.getElementById('cr-timer')!;
    this.tickerEl = this.shadowRoot.getElementById('cr-ticker')!;
    this.btnStart = this.shadowRoot.getElementById('cr-btn-start') as HTMLButtonElement;
    this.btnPause = this.shadowRoot.getElementById('cr-btn-pause') as HTMLButtonElement;
    this.btnStop = this.shadowRoot.getElementById('cr-btn-stop') as HTMLButtonElement;
    this.btnToggleDrawer = this.shadowRoot.getElementById('cr-btn-drawer') as HTMLButtonElement;
    this.nudgeEl = this.shadowRoot.getElementById('cr-nudge')!;

    this.drawerEl = this.shadowRoot.getElementById('cr-drawer')!;
    this.transcriptListEl = this.shadowRoot.getElementById('cr-transcript-list')!;
    this.wordCountStatEl = this.shadowRoot.getElementById('cr-stat-words')!;
    this.turnCountStatEl = this.shadowRoot.getElementById('cr-stat-turns')!;
  }

  private attachEventListeners(): void {
    // Recording controls
    this.btnStart.addEventListener('click', () => this.startRecording());
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnStop.addEventListener('click', () => this.stopRecording());
    this.btnToggleDrawer.addEventListener('click', () => this.toggleDrawer());

    const closeBtn = this.shadowRoot.getElementById('cr-drawer-close');
    closeBtn?.addEventListener('click', () => this.closeDrawer());

    // Tabs
    const tabBtns = this.shadowRoot.querySelectorAll<HTMLButtonElement>('.cr-tab');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) this.switchTab(tabName);
      });
    });

    // Exports
    const exportFormats: ExportFormat[] = ['txt', 'md', 'srt', 'vtt'];
    exportFormats.forEach((fmt) => {
      this.shadowRoot.getElementById(`cr-exp-${fmt}`)?.addEventListener('click', () => {
        downloadExport(this.session, fmt);
      });
    });
    this.shadowRoot.getElementById('cr-btn-copy-all')?.addEventListener('click', async () => {
      const success = await copyToClipboard(exportToTxt(this.session));
      if (success) {
        const btn = this.shadowRoot.getElementById('cr-btn-copy-all')!;
        const originalText = btn.textContent;
        btn.textContent = t('export.copied');
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
    });

    // New Meeting & Session Controls
    this.shadowRoot
      .getElementById('cr-btn-new-meeting')
      ?.addEventListener('click', () => this.handleNewMeetingClick());
    this.shadowRoot
      .getElementById('cr-btn-reset-meeting')
      ?.addEventListener('click', () => this.handleNewMeetingClick());
    this.shadowRoot.getElementById('cr-btn-rec-export')?.addEventListener('click', () => {
      this.openDrawer();
      this.switchTab('export');
    });
    this.shadowRoot
      .getElementById('cr-btn-rec-discard')
      ?.addEventListener('click', () => this.handleNewMeetingClick());

    // Page Unload / Navigation: Guarantee unflushed speech and active draft are persisted
    const handleUnload = () => {
      this.adapter.flush?.();
      if (this.status === 'recording') {
        this.session.endTime = Date.now();
      }
      if (this.session.segments.length > 0) {
        DraftStorageService.saveDraftImmediate(this.session);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // Sync with extension popup if draft is cleared externally
    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes['caption_recorder_unsaved_draft']) {
          if (!changes['caption_recorder_unsaved_draft'].newValue) {
            if (this.status === 'idle' && this.session.segments.length > 0) {
              this.resetSession(false);
            }
          }
        }
      });
    }

    // Draggable Widget
    this.initDraggable();

    // Monitor captions enabled state
    this.adapter.observe(
      async (caption) => {
        if (this.restorePromise) {
          await this.restorePromise;
        }

        // Finalized caption
        this.tickerEl.textContent = `${caption.speaker}: ${caption.text.slice(-25)}`;

        // Auto-start recording when speech arrives if idle and user hasn't manually stopped
        if (this.status === 'idle' && !this.userManuallyStopped) {
          console.info('[CaptionRecorder] Live captions detected, auto-starting recording session');
          this.startRecording();
        }

        if (this.status === 'recording') {
          const segment: TranscriptSegment = {
            id: `seg_${caption.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
            speaker: caption.speaker,
            startTime: caption.timestamp,
            endTime: caption.timestamp,
            text: caption.text,
          };
          this.session.segments.push(segment);
          this.updateStats();
          this.renderTranscriptList();
          this.updateNewMeetingButtons(true);
          DraftStorageService.saveDraftDebounced(this.session);
        }
      },
      (enabled) => {
        this.updateCaptionsNudge(enabled);
      },
      async (activeCaption) => {
        if (this.restorePromise) {
          await this.restorePromise;
        }

        this.activeDraft = activeCaption;
        if (activeCaption) {
          this.tickerEl.textContent = `${activeCaption.speaker}: ${activeCaption.text.slice(-25)}`;

          if (this.status === 'idle' && !this.userManuallyStopped) {
            console.info('[CaptionRecorder] Live draft detected, auto-starting recording session');
            this.startRecording();
          }
        } else if (this.session.segments.length === 0) {
          this.tickerEl.textContent = t('nudge.noCaptionsYet');
        }

        if (this.status === 'recording') {
          this.updateStats();
          this.renderTranscriptList();
        }
      }
    );
  }

  private async startRecording(): Promise<void> {
    if (this.restorePromise) {
      await this.restorePromise;
    }

    this.userManuallyStopped = false;
    this.status = 'recording';
    this.session.endTime = undefined;
    this.dotEl.className = 'cr-dot cr-dot-rec';
    this.btnStart.style.display = 'none';
    this.btnPause.style.display = 'flex';
    this.btnStop.style.display = 'flex';
    this.hideRecoveryBanner();
    this.updateNewMeetingButtons(true);

    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => {
        this.elapsedSeconds++;
        this.updateTimerDisplay();
      }, 1000);
    }

    this.checkCaptionsState();
  }

  private togglePause(): void {
    if (this.status === 'recording') {
      this.status = 'paused';
      this.dotEl.className = 'cr-dot cr-dot-paused';
      this.btnPause.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      this.btnPause.title = t('controls.resume');
      this.adapter.flush?.();
      this.activeDraft = null;
      this.renderTranscriptList();
    } else if (this.status === 'paused') {
      this.status = 'recording';
      this.dotEl.className = 'cr-dot cr-dot-rec';
      this.btnPause.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
      this.btnPause.title = t('controls.pause');
    }
  }

  private stopRecording(): void {
    this.userManuallyStopped = true;
    this.status = 'idle';
    this.dotEl.className = 'cr-dot';
    this.btnStart.style.display = 'flex';
    this.btnPause.style.display = 'none';
    this.btnStop.style.display = 'none';

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.adapter.flush?.();
    this.activeDraft = null;
    this.session.endTime = Date.now();
    this.updateStats();
    this.updateNewMeetingButtons(true);

    // Mirror to local draft immediately so user doesn't lose it
    DraftStorageService.saveDraftImmediate(this.session);

    // Open drawer to review & export
    this.openDrawer();
    this.switchTab('export');
  }

  private toggleDrawer(): void {
    if (this.drawerEl.classList.contains('cr-open')) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  private openDrawer(): void {
    this.drawerEl.classList.add('cr-open');
    this.renderTranscriptList(true);
  }

  private closeDrawer(): void {
    this.drawerEl.classList.remove('cr-open');
  }

  private switchTab(activeTab: string): void {
    const tabs = this.shadowRoot.querySelectorAll<HTMLButtonElement>('.cr-tab');
    tabs.forEach((tab) => {
      tab.classList.toggle('cr-active', tab.getAttribute('data-tab') === activeTab);
    });

    const contents = ['live', 'export'];
    contents.forEach((id) => {
      const contentEl = this.shadowRoot.getElementById(`cr-tab-${id}`);
      if (contentEl) {
        contentEl.style.display = id === activeTab ? 'block' : 'none';
      }
    });
  }

  private renderTranscriptList(force: boolean = false): void {
    if (!force && !this.drawerEl.classList.contains('cr-open')) {
      return;
    }

    const segments = this.session.segments;
    const hasActiveDraft = Boolean(this.activeDraft && this.status === 'recording');

    if (segments.length === 0 && !hasActiveDraft) {
      this.cachedSegmentsHtml = '';
      this.cachedSegmentsCount = 0;
      this.transcriptListEl.innerHTML = `
        <div style="color:#64748b; font-size:12px; text-align:center; padding:20px;">
          ${t('nudge.noCaptionsYet')}
        </div>
      `;
      return;
    }

    const baseTime = this.session.startTime;

    if (segments.length !== this.cachedSegmentsCount) {
      this.cachedSegmentsHtml = segments
        .map((seg) => this.buildSegmentHtml(seg, baseTime))
        .join('');
      this.cachedSegmentsCount = segments.length;
    }

    let activeDraftHtml = '';
    if (hasActiveDraft && this.activeDraft) {
      const timeDiff = Math.max(0, (this.activeDraft.timestamp || Date.now()) - baseTime);
      const totalSec = Math.floor(timeDiff / 1000);
      const mm = Math.floor(totalSec / 60)
        .toString()
        .padStart(2, '0');
      const ss = (totalSec % 60).toString().padStart(2, '0');

      activeDraftHtml = `
        <div class="cr-turn cr-active-turn">
          <div class="cr-turn-header">
            <span class="cr-speaker-badge">${CaptionOverlay.escapeHtml(this.activeDraft.speaker)}</span>
            <span class="cr-timestamp">${mm}:${ss}</span>
          </div>
          <div class="cr-turn-text">${CaptionOverlay.escapeHtml(this.activeDraft.text)}</div>
        </div>
      `;
    }

    this.transcriptListEl.innerHTML = this.cachedSegmentsHtml + activeDraftHtml;

    // Auto-scroll to bottom of transcript only if user was already near bottom or forced
    const el = this.transcriptListEl;
    if (
      !force &&
      typeof el.scrollHeight === 'number' &&
      typeof el.clientHeight === 'number' &&
      el.clientHeight > 0
    ) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  private buildSegmentHtml(seg: TranscriptSegment, baseTime: number): string {
    const timeDiff = Math.max(0, seg.startTime - baseTime);
    const totalSec = Math.floor(timeDiff / 1000);
    const mm = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');

    return `
      <div class="cr-turn">
        <div class="cr-turn-header">
          <span class="cr-speaker-badge">${CaptionOverlay.escapeHtml(seg.speaker)}</span>
          <span class="cr-timestamp">${mm}:${ss}</span>
        </div>
        <div class="cr-turn-text">${CaptionOverlay.escapeHtml(seg.text)}</div>
      </div>
    `;
  }

  private updateStats(): void {
    const segments = this.session.segments;

    if (segments.length === this.cachedSegmentsWordsCount + 1) {
      const lastSeg = segments[segments.length - 1];
      this.cachedFinalizedWords += CaptionOverlay.countWords(lastSeg?.text);
      this.cachedSegmentsWordsCount = segments.length;
    } else if (segments.length !== this.cachedSegmentsWordsCount) {
      this.cachedFinalizedWords = segments.reduce(
        (sum, seg) => sum + CaptionOverlay.countWords(seg.text),
        0
      );
      this.cachedSegmentsWordsCount = segments.length;
    }

    let totalWords = this.cachedFinalizedWords;
    let totalTurns = segments.length;

    if (this.activeDraft && this.status === 'recording') {
      const liveWords = CaptionOverlay.countWords(this.activeDraft.text);
      totalWords += liveWords;
      totalTurns += 1;
    }

    this.wordCountStatEl.textContent = totalWords.toString();
    this.turnCountStatEl.textContent = totalTurns.toString();
  }

  private static countWords(text?: string): number {
    if (!text) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  private updateTimerDisplay(): void {
    const h = Math.floor(this.elapsedSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((this.elapsedSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = (this.elapsedSeconds % 60).toString().padStart(2, '0');
    this.timerEl.textContent = `${h}:${m}:${s}`;
  }

  private checkCaptionsState(): void {
    const isEnabled = this.adapter.isCaptionsEnabled();
    this.updateCaptionsNudge(isEnabled);
  }

  private updateCaptionsNudge(isEnabled: boolean): void {
    if (!isEnabled && this.status === 'recording') {
      this.nudgeEl.classList.add('cr-visible');
    } else {
      this.nudgeEl.classList.remove('cr-visible');
    }
  }

  private initDraggable(): void {
    this.widgetEl.addEventListener('mousedown', (e: MouseEvent) => {
      // Ignore clicks on control buttons
      if ((e.target as HTMLElement).closest('button')) return;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.widgetEl.getBoundingClientRect();
      this.widgetStartX = rect.left;
      this.widgetStartY = rect.top;

      this.widgetEl.classList.add('cr-dragging');
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;

      const newX = Math.max(
        10,
        Math.min(window.innerWidth - this.widgetEl.offsetWidth - 10, this.widgetStartX + deltaX)
      );
      const newY = Math.max(
        10,
        Math.min(window.innerHeight - this.widgetEl.offsetHeight - 10, this.widgetStartY + deltaY)
      );

      this.widgetEl.style.left = `${newX}px`;
      this.widgetEl.style.top = `${newY}px`;
      this.widgetEl.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.widgetEl.classList.remove('cr-dragging');
      }
    });
  }

  /**
   * Restore any unsaved meeting draft from local storage across page reloads.
   */
  private async restoreDraftSession(): Promise<void> {
    try {
      const draft = await DraftStorageService.getUnsavedDraft();
      if (!draft || !Array.isArray(draft.segments) || draft.segments.length === 0) {
        return;
      }

      console.info(
        `[CaptionRecorder] Restoring saved draft session (${draft.segments.length} segments, ${draft.id})`
      );

      this.session = {
        id: draft.id || this.session.id,
        title: draft.title || document.title || 'Google Meet',
        startTime: draft.startTime || this.session.startTime,
        endTime: draft.endTime,
        segments: [...draft.segments],
        platform: draft.platform || 'google-meet',
        savedAt: draft.savedAt,
        url: draft.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      };

      const endTime = draft.endTime || draft.savedAt || Date.now();
      this.elapsedSeconds = Math.max(0, Math.floor((endTime - this.session.startTime) / 1000));

      this.cachedSegmentsHtml = '';
      this.cachedSegmentsCount = 0;
      this.cachedFinalizedWords = 0;
      this.cachedSegmentsWordsCount = 0;
      this.updateTimerDisplay();
      this.updateStats();
      this.renderTranscriptList(true);

      const lastSeg = draft.segments[draft.segments.length - 1];
      if (lastSeg) {
        this.tickerEl.textContent = `${lastSeg.speaker}: ${lastSeg.text.slice(-25)}`;
      }

      this.updateNewMeetingButtons(true);

      if (draft.endTime) {
        this.status = 'idle';
        this.userManuallyStopped = true;
        this.showRecoveryBanner(draft);
        // Automatically open the drawer to export tab after page reload if meeting has ended
        this.openDrawer();
        this.switchTab('export');
      } else {
        this.showRecoveryBanner(draft);
      }
    } catch (err) {
      console.warn('[CaptionRecorder] Failed to restore draft session', err);
    }
  }

  private showRecoveryBanner(draft: MeetingSession): void {
    const banner = this.shadowRoot.getElementById('cr-recovery-banner');
    const desc = this.shadowRoot.getElementById('cr-recovery-desc');
    if (!banner) return;

    banner.style.display = 'flex';
    if (desc) {
      const durationSec = Math.max(
        0,
        Math.floor(((draft.endTime || draft.savedAt || Date.now()) - draft.startTime) / 1000)
      );
      const m = Math.floor(durationSec / 60);
      const s = durationSec % 60;
      const speakers = Array.from(new Set(draft.segments.map((s) => s.speaker))).length;
      desc.textContent = `${draft.segments.length} turns • ${m}m ${s}s • ${speakers} speaker${speakers === 1 ? '' : 's'}`;
    }
  }

  private hideRecoveryBanner(): void {
    const banner = this.shadowRoot.getElementById('cr-recovery-banner');
    if (banner) banner.style.display = 'none';
  }

  private updateNewMeetingButtons(show: boolean): void {
    const btnHeader = this.shadowRoot.getElementById('cr-btn-new-meeting');
    const btnExport = this.shadowRoot.getElementById('cr-btn-reset-meeting');
    const displayVal = show ? 'inline-flex' : 'none';
    if (btnHeader) btnHeader.style.display = displayVal;
    if (btnExport) btnExport.style.display = displayVal;
  }

  private async handleNewMeetingClick(): Promise<void> {
    if (this.session.segments.length > 0) {
      const confirmed = window.confirm(t('recovery.discardConfirm'));
      if (!confirmed) return;
    }
    await this.resetSession();
  }

  private async resetSession(clearStorage: boolean = true): Promise<void> {
    if (this.status === 'recording') {
      this.userManuallyStopped = true;
      this.status = 'idle';
      this.dotEl.className = 'cr-dot';
      this.btnStart.style.display = 'flex';
      this.btnPause.style.display = 'none';
      this.btnStop.style.display = 'none';
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.adapter.flush?.();
    }

    if (clearStorage) {
      await DraftStorageService.clearDraft();
    }

    const now = Date.now();
    this.session = {
      id: `session_${now}`,
      title: document.title || 'Google Meet',
      startTime: now,
      segments: [],
      platform: 'google-meet',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.status = 'idle';
    this.elapsedSeconds = 0;
    this.userManuallyStopped = false;
    this.activeDraft = null;

    this.cachedSegmentsHtml = '';
    this.cachedSegmentsCount = 0;
    this.cachedFinalizedWords = 0;
    this.cachedSegmentsWordsCount = 0;
    this.updateTimerDisplay();
    this.updateStats();
    this.renderTranscriptList(true);
    this.hideRecoveryBanner();
    this.updateNewMeetingButtons(false);

    this.tickerEl.textContent = t('nudge.noCaptionsYet');
    this.dotEl.className = 'cr-dot';
    this.btnStart.style.display = 'flex';
    this.btnPause.style.display = 'none';
    this.btnStop.style.display = 'none';
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
