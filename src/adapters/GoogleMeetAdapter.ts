import type { InterimCaption } from '../core/types';
import type { PlatformAdapter } from './PlatformAdapter';

interface ElementTurnInfo {
  id: string;
  speaker: string;
  text: string;
  startTime: number;
  emitted: boolean;
}

export class GoogleMeetAdapter implements PlatformAdapter {
  public static readonly matchPatterns: readonly string[] = ['https://meet.google.com/*'];

  public readonly name = 'Google Meet';
  public readonly platformId = 'google-meet';

  private mutationObserver: MutationObserver | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private onCaptionCallback: ((caption: InterimCaption) => void) | null = null;
  private onCaptionsStateChangeCallback: ((enabled: boolean) => void) | null = null;
  private onActiveCaptionCallback: ((caption: InterimCaption | null) => void) | null = null;
  private lastKnownCaptionsEnabled: boolean = false;

  // Active chunk tracking for author-based switching
  private pendingCaption: {
    id: string;
    speaker: string;
    el: HTMLElement;
    trackKey: HTMLElement;
    text: string;
    startTime: number;
  } | null = null;
  private elementTurns = new WeakMap<HTMLElement, ElementTurnInfo>();
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

  // Exclude non-caption UI containers from caption extraction
  private static readonly EXCLUDE_SELECTORS = [
    '[role="dialog"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="listbox"]',
    '[role="toolbar"]',
    '[role="button"]',
    '[role="tooltip"]',
    '[data-tooltip]',
    '[aria-modal="true"]',
    'button',
    'input',
    'textarea',
    'select',
    '[contenteditable]',
    'nav',
    'header',
    'footer',
    '.VfPpkd-Bz112c-LgbsSe',
  ];

  private static readonly EXCLUDE_SELECTOR_STRING = GoogleMeetAdapter.EXCLUDE_SELECTORS.join(', ');

  // Material Icon ligature names occasionally rendered as raw text
  private static readonly ICON_FONT_LIGATURES = [
    'arrow_drop_down',
    'more_vert',
    'mic',
    'mic_off',
    'videocam',
    'videocam_off',
    'close',
    'check',
  ];

  public matchesUrl(url: string): boolean {
    return (
      /^https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url) ||
      /^https?:\/\/meet\.google\.com\/(_meet|lookup)\//i.test(url)
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
      if (this.isExcluded(el)) continue;
      const text = el.textContent?.trim() || '';
      if (this.isValidCaptionText(text)) {
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
    onActiveCaption?: (caption: InterimCaption | null) => void
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
        attributeFilter: ['aria-pressed', 'aria-label', 'class', 'style'],
      });

      if (typeof document.addEventListener === 'function') {
        document.addEventListener('click', this.handleUserInteraction, { passive: true });
        document.addEventListener('keyup', this.handleKeyup, { passive: true });
      }
    }

    // 2. 300ms scanner loop as resilient fallback
    this.pollInterval = setInterval(() => {
      this.checkCaptionsState();
      if (this.isCaptionsEnabled()) {
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
    this.onActiveCaptionCallback?.(null);
    this.pendingCaption = null;
    this.lastEmittedText = '';
    this.lastEmittedSpeaker = '';
    this.elementTurns = new WeakMap<HTMLElement, ElementTurnInfo>();
  }

  public flush(): void {
    if (!this.pendingCaption) return;

    this.onActiveCaptionCallback?.(null);
    const { id, speaker, trackKey, text, startTime } = this.pendingCaption;
    this.pendingCaption = null;

    const cleanText = text.trim();
    if (!cleanText || (speaker === this.lastEmittedSpeaker && cleanText === this.lastEmittedText)) {
      if (trackKey) {
        const info = this.elementTurns.get(trackKey);
        if (info) info.emitted = true;
      }
      return;
    }

    if (trackKey) {
      const info = this.elementTurns.get(trackKey);
      if (info) {
        info.emitted = true;
        info.text = cleanText;
        info.speaker = speaker;
      }
    }
    this.lastEmittedSpeaker = speaker;
    this.lastEmittedText = cleanText;

    const now = Date.now();
    this.onCaptionCallback?.({
      id,
      speaker: speaker.trim() || 'Speaker',
      text: cleanText,
      startTime: startTime || now,
      timestamp: now,
    });
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

    if (this.pendingCaption && !this.isElementConnected(this.pendingCaption.el)) {
      this.flush();
    }

    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement | Text;
      const el =
        target.nodeType === Node.ELEMENT_NODE ? (target as HTMLElement) : target.parentElement;

      if (!el || this.isExcluded(el)) continue;

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

    if (!this.isCaptionsEnabled()) {
      if (this.pendingCaption) {
        this.flush();
      }
      return;
    }

    if (this.pendingCaption && !this.isElementConnected(this.pendingCaption.el)) {
      this.flush();
    }

    const textEls = document.querySelectorAll<HTMLElement>(
      GoogleMeetAdapter.CAPTION_TEXT_SELECTOR_STRING
    );

    if (textEls.length === 0 && this.pendingCaption) {
      this.flush();
      return;
    }

    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i];
      if (!this.isExcluded(el)) {
        this.processCaptionElement(el);
      }
    }
  }

  private getCaptionTrackKey(textEl: HTMLElement): HTMLElement {
    const block =
      (typeof textEl.closest === 'function' &&
        textEl.closest<HTMLElement>(
          '[jsname="dsyhDe"] > div, .nMcdL, .bj4p3b, .nMxHgf, [jscontroller="TEZ40e"]'
        )) ||
      textEl.parentElement?.parentElement ||
      textEl.parentElement;

    return block || textEl;
  }

  private generateTurnId(startTime: number): string {
    return `seg_${startTime}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private processCaptionElement(textEl: HTMLElement): void {
    if (!this.onCaptionCallback || this.isExcluded(textEl)) return;

    const text = textEl.textContent?.trim() || '';
    if (!this.isValidCaptionText(text)) return;

    const speaker = this.extractSpeakerForTextElement(textEl);
    const trackKey = this.getCaptionTrackKey(textEl);

    const existingTurn = this.elementTurns.get(trackKey);

    // Case 1: The turn for this element was already emitted as a segment.
    if (existingTurn?.emitted) {
      // If text and speaker are identical, skip unchanged lingering caption (no duplicate emit).
      if (existingTurn.text === text && existingTurn.speaker === speaker) {
        return;
      }

      // Speech recognition revised/translated an earlier phrase in the DOM: update in-place!
      existingTurn.text = text;
      existingTurn.speaker = speaker;
      this.lastEmittedSpeaker = speaker;
      this.lastEmittedText = text;

      const now = Date.now();
      this.onCaptionCallback?.({
        id: existingTurn.id,
        speaker: speaker.trim() || 'Speaker',
        text,
        startTime: existingTurn.startTime,
        timestamp: now,
      });
      return;
    }

    // Case 2: Skip lingering caption that matches the last emitted text/speaker if not tracked
    if (speaker === this.lastEmittedSpeaker && text === this.lastEmittedText) {
      const now = Date.now();
      const id = this.generateTurnId(now);
      this.elementTurns.set(trackKey, {
        id,
        speaker,
        text,
        startTime: now,
        emitted: true,
      });
      return;
    }

    // Case 3: Same chunk element and same speaker: update current speech draft
    if (
      this.pendingCaption &&
      this.pendingCaption.trackKey === trackKey &&
      this.pendingCaption.speaker === speaker
    ) {
      this.pendingCaption.text = text;
      if (existingTurn) {
        existingTurn.text = text;
      }
      this.onActiveCaptionCallback?.({
        id: this.pendingCaption.id,
        speaker: speaker.trim() || 'Speaker',
        text,
        startTime: this.pendingCaption.startTime,
        timestamp: Date.now(),
      });
      return;
    }

    // Case 4: Chunk element or author switched: finalize previous chunk immediately
    this.flush();

    const now = Date.now();
    const turnId = existingTurn?.id || this.generateTurnId(now);
    const turnInfo: ElementTurnInfo = {
      id: turnId,
      speaker,
      text,
      startTime: existingTurn?.startTime || now,
      emitted: false,
    };
    this.elementTurns.set(trackKey, turnInfo);

    this.pendingCaption = {
      id: turnId,
      speaker,
      el: textEl,
      trackKey,
      text,
      startTime: turnInfo.startTime,
    };
    this.onActiveCaptionCallback?.({
      id: turnId,
      speaker: speaker.trim() || 'Speaker',
      text,
      startTime: turnInfo.startTime,
      timestamp: now,
    });
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

  private isValidCaptionText(text: string): boolean {
    if (!text || text.length === 0) return false;

    if (GoogleMeetAdapter.ICON_FONT_LIGATURES.includes(text.toLowerCase())) {
      return false;
    }

    return true;
  }

  private isExcluded(el: HTMLElement): boolean {
    if (!el) return true;
    return Boolean(el.closest(GoogleMeetAdapter.EXCLUDE_SELECTOR_STRING));
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

    const result = {
      isCaptionsEnabled: this.isCaptionsEnabled(),
      activeCaptionElementsCount: textEls.length,
      activeCaptionElements: textEls,
      pendingCaption: this.pendingCaption
        ? { speaker: this.pendingCaption.speaker, text: this.pendingCaption.text }
        : null,
      lastEmittedText: this.lastEmittedText,
    };

    console.info('[CaptionRecorder Diagnostics]', result);
    return result;
  }
}
