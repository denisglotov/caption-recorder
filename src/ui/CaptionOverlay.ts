import type { PlatformAdapter } from '../adapters/PlatformAdapter';
import { StreamReconciler } from '../core/StreamReconciler';
import type { MeetingSession, RecordingStatus } from '../core/types';
import { downloadExport, exportToTxt, copyToClipboard, type ExportFormat } from '../core/exporters';
import { GeminiNanoService } from '../services/GeminiNanoService';
import { DraftStorageService } from '../services/DraftStorageService';
import { t } from '../i18n';

export class CaptionOverlay {
  private shadowRoot: ShadowRoot;
  private adapter: PlatformAdapter;
  private reconciler: StreamReconciler;

  private status: RecordingStatus = 'idle';
  private session: MeetingSession;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds: number = 0;
  private userManuallyStopped: boolean = false;

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
  private aiOutputEl!: HTMLElement;
  private btnGenerateAI!: HTMLButtonElement;
  private btnCopyAI!: HTMLButtonElement;
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
    this.reconciler = new StreamReconciler();

    const now = Date.now();
    this.session = {
      id: `session_${now}`,
      title: document.title || 'Google Meet',
      startTime: now,
      segments: [],
      platform: 'google-meet',
    };

    this.initDOM();
    this.attachEventListeners();
    this.checkCaptionsState();
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
          <button class="cr-drawer-close" id="cr-drawer-close" title="${t('controls.closeDrawer')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="cr-tabs">
          <button class="cr-tab cr-active" data-tab="live">${t('tabs.live')}</button>
          <button class="cr-tab" data-tab="summary">${t('tabs.summary')}</button>
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

        <!-- Tab 2: AI Summary -->
        <div class="cr-tab-content" id="cr-tab-summary" style="display:none;">
          <div class="cr-ai-notice" id="cr-ai-notice" style="display:none;"></div>
          <div class="cr-ai-actions">
            <button class="cr-btn-primary" id="cr-btn-ai-gen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              <span>${t('summary.generate')}</span>
            </button>
            <button class="cr-btn-secondary" id="cr-btn-ai-copy" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>${t('summary.copy')}</span>
            </button>
          </div>
          <div class="cr-ai-box" id="cr-ai-output">
            ${t('summary.empty')}
          </div>
        </div>

        <!-- Tab 3: Export -->
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
    this.aiOutputEl = this.shadowRoot.getElementById('cr-ai-output')!;
    this.btnGenerateAI = this.shadowRoot.getElementById('cr-btn-ai-gen') as HTMLButtonElement;
    this.btnCopyAI = this.shadowRoot.getElementById('cr-btn-ai-copy') as HTMLButtonElement;
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

    // AI Summary
    this.btnGenerateAI.addEventListener('click', () => this.handleGenerateAI());
    this.btnCopyAI.addEventListener('click', () => this.handleCopyAI());

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

    // Draggable Widget
    this.initDraggable();

    // Reconciler subscriptions
    this.reconciler.onSegmentFinalized((segment) => {
      this.session.segments.push(segment);
      this.updateStats();
      this.renderTranscriptList();
      DraftStorageService.saveDraftDebounced(this.session);
    });

    this.reconciler.onActiveTurnUpdate((activeSegment) => {
      if (activeSegment) {
        this.tickerEl.textContent = `${activeSegment.speaker}: ${activeSegment.text.slice(-25)}`;
      }
      this.renderTranscriptList();
    });

    // Monitor captions enabled state
    this.adapter.observe(
      (caption) => {
        // Update live ticker immediately
        this.tickerEl.textContent = `${caption.speaker}: ${caption.text.slice(-25)}`;

        // Auto-start recording when speech arrives if idle and user hasn't manually stopped
        if (this.status === 'idle' && !this.userManuallyStopped) {
          console.info('[CaptionRecorder] Live captions detected, auto-starting recording session');
          this.startRecording();
        }

        if (this.status === 'recording') {
          this.reconciler.ingest(caption);
        }
      },
      (enabled) => {
        this.updateCaptionsNudge(enabled);
      }
    );
  }

  private startRecording(): void {
    this.userManuallyStopped = false;
    this.status = 'recording';
    this.dotEl.className = 'cr-dot cr-dot-rec';
    this.btnStart.style.display = 'none';
    this.btnPause.style.display = 'flex';
    this.btnStop.style.display = 'flex';

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
      this.reconciler.finalizeActiveTurn();
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

    this.reconciler.finalizeActiveTurn();
    this.session.endTime = Date.now();
    this.updateStats();

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
    this.renderTranscriptList();
  }

  private closeDrawer(): void {
    this.drawerEl.classList.remove('cr-open');
  }

  private switchTab(activeTab: string): void {
    const tabs = this.shadowRoot.querySelectorAll<HTMLButtonElement>('.cr-tab');
    tabs.forEach((tab) => {
      tab.classList.toggle('cr-active', tab.getAttribute('data-tab') === activeTab);
    });

    const contents = ['live', 'summary', 'export'];
    contents.forEach((id) => {
      const contentEl = this.shadowRoot.getElementById(`cr-tab-${id}`);
      if (contentEl) {
        contentEl.style.display = id === activeTab ? 'block' : 'none';
      }
    });

    if (activeTab === 'summary') {
      this.checkAIStatus();
    }
  }

  private async checkAIStatus(): Promise<void> {
    const status = await GeminiNanoService.checkAvailability();
    const noticeEl = this.shadowRoot.getElementById('cr-ai-notice');
    if (!noticeEl) return;

    if (status.status === 'unsupported-browser') {
      noticeEl.textContent = t('summary.nonChrome');
      noticeEl.style.display = 'block';
      this.btnGenerateAI.disabled = true;
    } else if (status.status === 'after-download') {
      noticeEl.textContent = t('summary.instructions');
      noticeEl.style.display = 'block';
    } else if (status.status === 'no') {
      noticeEl.textContent = `${t('summary.notAvailable')} ${t('summary.instructions')}`;
      noticeEl.style.display = 'block';
    } else {
      noticeEl.style.display = 'none';
      this.btnGenerateAI.disabled = false;
    }
  }

  private async handleGenerateAI(): Promise<void> {
    const segments = this.reconciler.getAllSegments();
    if (segments.length === 0) {
      this.aiOutputEl.textContent = t('summary.empty');
      return;
    }

    this.btnGenerateAI.disabled = true;
    this.aiOutputEl.textContent = t('summary.generating');

    try {
      const result = await GeminiNanoService.summarizeMeeting(segments, (progress) => {
        this.aiOutputEl.textContent = progress;
      });

      this.session.aiSummary = result.summary;
      this.aiOutputEl.textContent = result.summary;
      this.btnCopyAI.style.display = 'inline-flex';
      DraftStorageService.saveDraftDebounced(this.session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.aiOutputEl.textContent = `Summary error: ${message}`;
    } finally {
      this.btnGenerateAI.disabled = false;
    }
  }

  private async handleCopyAI(): Promise<void> {
    if (this.session.aiSummary) {
      const success = await copyToClipboard(this.session.aiSummary);
      if (success) {
        const span = this.btnCopyAI.querySelector('span')!;
        const originalText = span.textContent;
        span.textContent = t('summary.copied');
        setTimeout(() => {
          span.textContent = originalText;
        }, 2000);
      }
    }
  }

  private renderTranscriptList(): void {
    const segments = this.reconciler.getAllSegments();
    if (segments.length === 0) {
      this.transcriptListEl.innerHTML = `
        <div style="color:#64748b; font-size:12px; text-align:center; padding:20px;">
          ${t('nudge.noCaptionsYet')}
        </div>
      `;
      return;
    }

    const baseTime = this.session.startTime;
    const activeSeg = this.reconciler.getActiveSegment();

    this.transcriptListEl.innerHTML = segments
      .map((seg) => {
        const isActive = activeSeg && activeSeg.id === seg.id;
        const timeDiff = Math.max(0, seg.startTime - baseTime);
        const totalSec = Math.floor(timeDiff / 1000);
        const mm = Math.floor(totalSec / 60)
          .toString()
          .padStart(2, '0');
        const ss = (totalSec % 60).toString().padStart(2, '0');

        return `
          <div class="cr-turn ${isActive ? 'cr-active-turn' : ''}">
            <div class="cr-turn-header">
              <span class="cr-speaker-badge">${CaptionOverlay.escapeHtml(seg.speaker)}</span>
              <span class="cr-timestamp">${mm}:${ss}</span>
            </div>
            <div class="cr-turn-text">${CaptionOverlay.escapeHtml(seg.text)}</div>
          </div>
        `;
      })
      .join('');

    // Auto-scroll to bottom of transcript
    this.transcriptListEl.scrollTop = this.transcriptListEl.scrollHeight;
  }

  private updateStats(): void {
    const segments = this.reconciler.getAllSegments();
    const totalWords = segments.reduce((sum, seg) => sum + seg.text.split(/\s+/).length, 0);
    this.wordCountStatEl.textContent = totalWords.toString();
    this.turnCountStatEl.textContent = segments.length.toString();
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

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
