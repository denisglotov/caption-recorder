import type { InterimCaption } from '../core/types';
import type { PlatformAdapter } from './PlatformAdapter';

export class GoogleMeetAdapter implements PlatformAdapter {
  public readonly name = 'Google Meet';
  public readonly platformId = 'google-meet';

  private mutationObserver: MutationObserver | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private onCaptionCallback: ((caption: InterimCaption) => void) | null = null;
  private onCaptionsStateChangeCallback: ((enabled: boolean) => void) | null = null;
  private onActiveCaptionCallback: ((caption: InterimCaption | null) => void) | null = null;
  private lastKnownCaptionsEnabled: boolean = false;

  // Active chunk tracking for author-based switching
  private pendingCaption: { speaker: string; el: HTMLElement; text: string } | null = null;
  private emittedElements = new WeakSet<HTMLElement>();
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
    'span[jsname="WqqAi"]',
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
    'caption-recorder-root',
    '.cr-container',
    '.cr-widget',
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
      url.includes('meet.google.com')
    );
  }

  public findCaptionButton(): HTMLElement | null {
    if (typeof document === 'undefined' || !document.querySelector) return null;

    // 1. Direct Google Meet CC button selectors (universal across locales)
    const directBtn = document.querySelector<HTMLElement>(
      'button[aria-keyshortcuts="c"], ' +
        'button[aria-keyshortcuts*="c"], ' +
        'button[jsname="r8qRAd"], ' +
        'button[data-tooltip-id*="caption" i], ' +
        'button[data-tooltip*="caption" i], ' +
        'button[aria-label*="caption" i]'
    );
    if (directBtn) return directBtn;

    // 2. Scan buttons for Material Icons (Google uses closed_caption / subtitles ligature font names)
    const buttons = document.querySelectorAll<HTMLElement>(
      'button, [role="button"], [role="menuitem"]'
    );
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
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
    this.flush();
    this.onActiveCaptionCallback?.(null);
    this.pendingCaption = null;
    this.lastEmittedText = '';
    this.lastEmittedSpeaker = '';
    this.emittedElements = new WeakSet<HTMLElement>();
  }

  public flush(): void {
    if (!this.pendingCaption) return;

    this.onActiveCaptionCallback?.(null);
    const { speaker, el, text } = this.pendingCaption;
    this.pendingCaption = null;

    const cleanText = text.trim();
    if (!cleanText || (speaker === this.lastEmittedSpeaker && cleanText === this.lastEmittedText)) {
      if (el) this.emittedElements.add(el);
      return;
    }

    if (el) {
      this.emittedElements.add(el);
    }
    this.lastEmittedSpeaker = speaker;
    this.lastEmittedText = cleanText;

    console.info(`[CaptionRecorder] CC Final Captured: [${speaker}] ${cleanText}`);

    this.onCaptionCallback?.({
      speaker: speaker.trim() || 'Speaker',
      text: cleanText,
      timestamp: Date.now(),
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
    if (!this.isCaptionsEnabled()) {
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

  private processCaptionElement(textEl: HTMLElement): void {
    if (!this.onCaptionCallback || this.isExcluded(textEl)) return;

    if (this.emittedElements.has(textEl)) return;

    const text = textEl.textContent?.trim() || '';
    if (!this.isValidCaptionText(text)) return;

    const speaker = this.extractSpeakerForTextElement(textEl);

    // Skip lingering caption that was already emitted
    if (speaker === this.lastEmittedSpeaker && text === this.lastEmittedText) {
      this.emittedElements.add(textEl);
      return;
    }

    // If same chunk element and same speaker: update current speech draft
    if (
      this.pendingCaption &&
      this.pendingCaption.el === textEl &&
      this.pendingCaption.speaker === speaker
    ) {
      this.pendingCaption.text = text;
      this.onActiveCaptionCallback?.({
        speaker: speaker.trim() || 'Speaker',
        text,
        timestamp: Date.now(),
      });
      return;
    }

    // Chunk element or author switched: finalize previous chunk immediately
    this.flush();

    this.pendingCaption = {
      speaker,
      el: textEl,
      text,
    };
    this.onActiveCaptionCallback?.({
      speaker: speaker.trim() || 'Speaker',
      text,
      timestamp: Date.now(),
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
