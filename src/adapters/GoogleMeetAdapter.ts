import type { InterimCaption } from '../core/types';
import type { PlatformAdapter } from './PlatformAdapter';

interface ChunkInfo {
  id: string;
  el: HTMLElement;
  text: string;
  startTime: number;
  finalized: boolean;
}

interface SpeakerState {
  lastFinalizedText: string;
  activeChunks: ChunkInfo[];
}

export class GoogleMeetAdapter implements PlatformAdapter {
  public static readonly matchPatterns: readonly string[] = ['https://meet.google.com/*'];

  public readonly name = 'Google Meet';
  public readonly platformId = 'google-meet';

  private mutationObserver: MutationObserver | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private onCaptionCallback: ((caption: InterimCaption) => void) | null = null;
  private onCaptionsStateChangeCallback: ((enabled: boolean) => void) | null = null;
  private onActiveCaptionCallback: ((captions: InterimCaption[]) => void) | null = null;
  private lastKnownCaptionsEnabled: boolean = false;

  // 3-chunk sliding window state per speaker:
  // last and second-from-last chunks are pending; third-from-last chunk is finalized.
  private speakerStates = new Map<string, SpeakerState>();
  private lastEmittedText: string = '';
  private lastEmittedSpeaker: string = '';

  // Dedicated Google Meet caption text selectors
  private static readonly CAPTION_TEXT_SELECTORS = [
    '.ygicle',
    '.VbkSUe',
    '[jsname="YS01Ge"]',
    '.iTTPOb',
  ];

  private static readonly CAPTION_TEXT_SELECTOR_STRING =
    GoogleMeetAdapter.CAPTION_TEXT_SELECTORS.join(', ');

  // Speaker name selectors
  private static readonly SPEAKER_SELECTORS = [
    '.NWpY1d', // Modern Meet speaker name
    '[jsname="WqqAi"]',
    '.zs7Du',
    '.poVWob',
  ];

  public matchesUrl(url: string): boolean {
    return (
      /^https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url) ||
      /^https?:\/\/meet\.google\.com\/(_meet|lookup|call)\//i.test(url)
    );
  }

  public isSameMeeting(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return u1.origin === u2.origin && u1.pathname === u2.pathname;
    } catch {
      return url1 === url2;
    }
  }

  public findCaptionButton(): HTMLElement | null {
    if (typeof document === 'undefined' || !document.querySelector) return null;

    const isJumpButton = (btn: HTMLElement): boolean => {
      const ariaLabel =
        typeof btn.getAttribute === 'function'
          ? (btn.getAttribute('aria-label') || '').toLowerCase()
          : '';
      if (ariaLabel.includes('jump')) return true;
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('arrow_downward') || text.includes('jump')) return true;
      if (typeof btn.closest === 'function' && btn.closest('.vNKgIf, .UDinHf, .IMKgW')) return true;
      return false;
    };

    // 1. Direct Google Meet CC button selectors (universal across locales)
    const directCandidates =
      typeof document.querySelectorAll === 'function'
        ? document.querySelectorAll<HTMLElement>(
            'button[aria-keyshortcuts="c"], ' +
              'button[aria-keyshortcuts*="c"], ' +
              'button[jsname="r8qRAd"], ' +
              'button[data-tooltip-id*="caption" i], ' +
              'button[data-tooltip*="caption" i], ' +
              'button[aria-label*="caption" i]'
          )
        : [];
    for (let i = 0; i < directCandidates.length; i++) {
      const btn = directCandidates[i];
      if (!isJumpButton(btn)) {
        return btn;
      }
    }

    // 2. Scan buttons for Material Icons (Google uses closed_caption / subtitles ligature font names)
    const buttons =
      typeof document.querySelectorAll === 'function'
        ? document.querySelectorAll<HTMLElement>('button, [role="button"], [role="menuitem"]')
        : [];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (isJumpButton(btn)) continue;
      const text = btn.textContent || '';
      if (text.includes('closed_caption') || text.includes('subtitles')) {
        return btn;
      }
    }

    return null;
  }

  public isCaptionsEnabled(): boolean {
    const ccBtn = this.findCaptionButton();
    if (ccBtn) {
      // 1. Check aria-pressed (most authoritative WAI-ARIA state: "true" | "false")
      const ariaPressed =
        typeof ccBtn.getAttribute === 'function' ? ccBtn.getAttribute('aria-pressed') : null;
      if (ariaPressed === 'true') return true;
      if (ariaPressed === 'false') return false;

      // 2. Check icon text inside the button
      const text = ccBtn.textContent || '';
      if (text.includes('closed_caption_off') || text.includes('subtitles_off')) {
        return false;
      }
      if (text.includes('closed_caption') || text.includes('subtitles')) {
        return true;
      }
    }

    // 3. Fallback: If no button found, inspect caption text elements in DOM.
    // Must be VISIBLE and non-empty. Never just check [jsname="dsyhDe"] existence
    // because Google Meet keeps empty containers in the DOM when captions are turned off.
    return this.hasVisibleCaptionText();
  }

  private hasVisibleCaptionText(): boolean {
    if (typeof document === 'undefined' || !document.querySelectorAll) return false;

    const textEls = document.querySelectorAll<HTMLElement>(
      GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING
    );
    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i];
      const text = el.textContent?.trim() || '';
      if (text.length > 0) {
        if (typeof el.offsetWidth === 'number' && typeof el.offsetHeight === 'number') {
          if (el.offsetWidth > 0 || el.offsetHeight > 0) {
            return true;
          }
        }
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  }

  private handleUserInteraction = (): void => {
    this.checkCaptionsState();
    if (typeof setTimeout === 'function') {
      setTimeout(() => this.checkCaptionsState(), 100);
    }
  };

  private handleKeyup = (e: KeyboardEvent): void => {
    if (e.key === 'c' || e.key === 'C') {
      this.handleUserInteraction();
    }
  };

  public observe(
    onCaption: (caption: InterimCaption) => void,
    onCaptionsStateChange?: (enabled: boolean) => void,
    onActiveCaption?: (captions: InterimCaption[]) => void
  ): void {
    this.stop();

    this.onCaptionCallback = onCaption;
    this.onCaptionsStateChangeCallback = onCaptionsStateChange || null;
    this.onActiveCaptionCallback = onActiveCaption || null;

    // 1. Observe DOM mutations including attribute changes for real-time responsiveness
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    if (typeof document !== 'undefined' && document.body) {
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-label'],
      });

      if (typeof document.addEventListener === 'function') {
        document.addEventListener('click', this.handleUserInteraction, { passive: true });
        document.addEventListener('keyup', this.handleKeyup, { passive: true });
      }
    }

    // 2. 300ms scanner loop as resilient fallback
    this.pollInterval = setInterval(() => {
      this.checkCaptionsState();
      if (this.lastKnownCaptionsEnabled) {
        this.scanActiveCaptions();
      }
    }, 300);

    this.checkCaptionsState();

    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__crDebug = () => this.runDiagnostics();
      console.info(
        '[CaptionRecorder] Meet adapter active. Type __crDebug() in console to inspect DOM.'
      );
    }
  }

  public stop(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('click', this.handleUserInteraction);
      document.removeEventListener('keyup', this.handleKeyup);
    }
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__crDebug;
    }
    this.flush();
    this.onActiveCaptionCallback?.([]);
    this.speakerStates.clear();
    this.lastEmittedText = '';
    this.lastEmittedSpeaker = '';
  }

  public flushSpeaker(speaker: string): void {
    const speakerState = this.speakerStates.get(speaker);
    if (!speakerState) return;

    const now = Date.now();
    const unfinalized = speakerState.activeChunks.filter((c) => !c.finalized);

    for (const chunk of unfinalized) {
      const cleanText = chunk.text.trim();
      if (cleanText && cleanText !== speakerState.lastFinalizedText) {
        speakerState.lastFinalizedText = cleanText;
        this.lastEmittedSpeaker = speaker;
        this.lastEmittedText = cleanText;
        this.onCaptionCallback?.({
          id: chunk.id,
          speaker: speaker.trim() || 'Speaker',
          text: cleanText,
          startTime: chunk.startTime,
          timestamp: now,
        });
      }
      chunk.finalized = true;
    }

    speakerState.activeChunks = speakerState.activeChunks.filter((c) =>
      this.isElementConnected(c.el)
    );
    if (speakerState.activeChunks.length === 0) {
      this.speakerStates.delete(speaker);
    }
  }

  public flush(): void {
    this.onActiveCaptionCallback?.([]);
    for (const speaker of Array.from(this.speakerStates.keys())) {
      this.flushSpeaker(speaker);
    }
  }

  private isElementConnected(el?: HTMLElement): boolean {
    if (!el) return false;
    if (typeof el.isConnected === 'boolean') {
      return el.isConnected;
    }
    if (
      typeof document !== 'undefined' &&
      document.body &&
      typeof document.body.contains === 'function'
    ) {
      return document.body.contains(el);
    }
    return true;
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.onCaptionCallback) return;

    this.checkCaptionsState();
    if (!this.lastKnownCaptionsEnabled) {
      return;
    }

    for (const [speaker, state] of Array.from(this.speakerStates.entries())) {
      if (
        state.activeChunks.length > 0 &&
        state.activeChunks.every((c) => !this.isElementConnected(c.el))
      ) {
        this.flushSpeaker(speaker);
      }
    }

    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement | Text;
      const el =
        target.nodeType === Node.ELEMENT_NODE ? (target as HTMLElement) : target.parentElement;

      if (!el) continue;

      const textEl = el.closest<HTMLElement>(GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING);
      if (textEl) {
        this.processCaptionElement(textEl);
      } else if (mutation.type === 'childList' && typeof el.querySelectorAll === 'function') {
        const nestedTextEls = el.querySelectorAll<HTMLElement>(
          GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING
        );
        for (let i = 0; i < nestedTextEls.length; i++) {
          this.processCaptionElement(nestedTextEls[i]);
        }
      }
    }
  }

  private scanActiveCaptions(): void {
    if (!this.onCaptionCallback) return;

    for (const [speaker, state] of Array.from(this.speakerStates.entries())) {
      if (
        state.activeChunks.length > 0 &&
        state.activeChunks.every((c) => !this.isElementConnected(c.el))
      ) {
        this.flushSpeaker(speaker);
      }
    }

    const textEls = document.querySelectorAll<HTMLElement>(
      GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING
    );

    if (textEls.length === 0) {
      let hasUnfinalized = false;
      for (const state of this.speakerStates.values()) {
        if (state.activeChunks.some((c) => !c.finalized)) {
          hasUnfinalized = true;
          break;
        }
      }
      if (hasUnfinalized) {
        this.flush();
      }
      return;
    }

    const presentSpeakers = new Set<string>();
    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i];
      const sp = this.extractSpeakerForTextElement(el).trim() || 'Speaker';
      presentSpeakers.add(sp);
      this.processCaptionElement(el);
    }

    for (const [speaker, state] of Array.from(this.speakerStates.entries())) {
      if (state.activeChunks.length > 0 && !presentSpeakers.has(speaker)) {
        this.flushSpeaker(speaker);
      }
    }
  }

  private generateTurnId(startTime: number): string {
    return `seg_${startTime}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private processCaptionElement(textEl: HTMLElement): void {
    if (!this.onCaptionCallback) return;

    const text = textEl.textContent?.trim() || '';
    if (!text) return;

    const speaker = this.extractSpeakerForTextElement(textEl).trim() || 'Speaker';

    // Container reuse check: if this element was previously tracked for another speaker, remove it
    for (const [sName, state] of this.speakerStates.entries()) {
      if (sName !== speaker) {
        state.activeChunks = state.activeChunks.filter((c) => c.el !== textEl);
      }
    }

    let speakerState = this.speakerStates.get(speaker);
    if (!speakerState) {
      speakerState = { lastFinalizedText: '', activeChunks: [] };
      this.speakerStates.set(speaker, speakerState);
    }

    // Clean up any disconnected elements
    speakerState.activeChunks = speakerState.activeChunks.filter((c) =>
      this.isElementConnected(c.el)
    );

    const existingChunk = speakerState.activeChunks.find((c) => c.el === textEl);
    if (existingChunk) {
      const cleanText = text.trim();
      if (existingChunk.finalized) {
        if (cleanText === existingChunk.text) {
          return;
        }

        const isExtension =
          cleanText.startsWith(existingChunk.text) || existingChunk.text.startsWith(cleanText);
        const hasActiveChunks = speakerState.activeChunks.some((c) => !c.finalized);

        if (isExtension || hasActiveChunks) {
          existingChunk.text = cleanText;
          speakerState.lastFinalizedText = cleanText;
          this.lastEmittedSpeaker = speaker;
          this.lastEmittedText = cleanText;
          this.onCaptionCallback?.({
            id: existingChunk.id,
            speaker,
            text: cleanText,
            startTime: existingChunk.startTime,
            timestamp: Date.now(),
          });
          return;
        }

        // Container reused for a brand new sentence
        const now = Date.now();
        existingChunk.id = this.generateTurnId(now);
        existingChunk.text = cleanText;
        existingChunk.startTime = now;
        existingChunk.finalized = false;
      } else {
        existingChunk.text = cleanText;
      }
    } else {
      const now = Date.now();
      speakerState.activeChunks.push({
        id: this.generateTurnId(now),
        el: textEl,
        text: text.trim(),
        startTime: now,
        finalized: false,
      });
    }

    // 3-chunk sliding window:
    // If there are >= 3 unfinalized chunks, finalize older unfinalized chunks so only 2 remain pending
    const unfinalized = speakerState.activeChunks.filter((c) => !c.finalized);
    const U = unfinalized.length;
    if (U >= 3) {
      const toFinalize = unfinalized.slice(0, U - 2);
      for (const candidate of toFinalize) {
        const cleanFinalizeText = candidate.text.trim();
        if (cleanFinalizeText && cleanFinalizeText !== speakerState.lastFinalizedText) {
          speakerState.lastFinalizedText = cleanFinalizeText;
          this.lastEmittedSpeaker = speaker;
          this.lastEmittedText = cleanFinalizeText;
          this.onCaptionCallback?.({
            id: candidate.id,
            speaker,
            text: cleanFinalizeText,
            startTime: candidate.startTime,
            timestamp: Date.now(),
          });
        }
        candidate.finalized = true;
      }
    }

    // Active drafts: emit unfinalized chunks (last and second-from-last pending chunks)
    const pendingChunks = speakerState.activeChunks.filter((c) => !c.finalized);
    const activeDrafts: InterimCaption[] = pendingChunks
      .filter((c) => c.text.trim().length > 0)
      .map((c) => ({
        id: c.id,
        speaker,
        text: c.text.trim(),
        startTime: c.startTime,
        timestamp: Date.now(),
      }));

    this.onActiveCaptionCallback?.(activeDrafts);
  }

  private extractSpeakerForTextElement(textEl: HTMLElement): string {
    const block =
      textEl.closest<HTMLElement>(
        '[jsname="dsyhDe"] > div, .nMcdL, .bj4p3b, .nMxHgf, [jscontroller="TEZ40e"]'
      ) ||
      textEl.parentElement?.parentElement ||
      textEl.parentElement;

    if (block) {
      for (const sel of GoogleMeetAdapter.SPEAKER_SELECTORS) {
        const speakerEl = block.querySelector<HTMLElement>(sel);
        if (speakerEl && speakerEl.textContent?.trim()) {
          return speakerEl.textContent.trim();
        }
      }

      const selfName = block.getAttribute('data-self-name');
      if (selfName?.trim()) return selfName.trim();
    }

    return 'Speaker';
  }

  private checkCaptionsState(): void {
    const isEnabled = this.isCaptionsEnabled();
    if (isEnabled !== this.lastKnownCaptionsEnabled) {
      this.lastKnownCaptionsEnabled = isEnabled;
      if (!isEnabled) {
        this.flush();
      }
      this.onCaptionsStateChangeCallback?.(isEnabled);
    }
  }

  public runDiagnostics(): Record<string, unknown> {
    const textEls = Array.from(
      document.querySelectorAll(GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING)
    ).map((el) => ({
      tagName: el.tagName,
      className: el.className,
      jsname: el.getAttribute('jsname'),
      text: el.textContent?.slice(0, 60),
    }));

    const speakerSummaries = Array.from(this.speakerStates.entries()).map(([speaker, state]) => ({
      speaker,
      lastFinalizedText: state.lastFinalizedText,
      activeChunksCount: state.activeChunks.length,
      activeChunks: state.activeChunks.map((c) => ({
        id: c.id,
        text: c.text.slice(0, 40),
        startTime: c.startTime,
      })),
    }));

    const result = {
      isCaptionsEnabled: this.isCaptionsEnabled(),
      activeCaptionElementsCount: textEls.length,
      activeCaptionElements: textEls,
      speakers: speakerSummaries,
      lastEmittedText: this.lastEmittedText,
      lastEmittedSpeaker: this.lastEmittedSpeaker,
    };

    console.info('[CaptionRecorder Diagnostics]', result);
    return result;
  }
}
