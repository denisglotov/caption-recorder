import type { InterimCaption } from '../core/types';
import type { PlatformAdapter } from './PlatformAdapter';

export class GoogleMeetAdapter implements PlatformAdapter {
  public readonly name = 'Google Meet';
  public readonly platformId = 'google-meet';

  private mutationObserver: MutationObserver | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private onCaptionCallback: ((caption: InterimCaption) => void) | null = null;
  private onCaptionsStateChangeCallback: ((enabled: boolean) => void) | null = null;
  private lastKnownCaptionsEnabled: boolean = false;
  private lastCapturedText: string = '';

  // Dedicated Google Meet caption text selectors
  private static readonly CAPTION_TEXT_SELECTORS = [
    '[jsname="dsyhDe"] .ygicle',
    '[jsname="dsyhDe"] .VbkSUe',
    '.ygicle.VbkSUe',
    '.ygicle',
    '.VbkSUe',
    '[jsname="YS01Ge"]',
    '.iTTPOb',
  ];

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

  public isCaptionsEnabled(): boolean {
    // 1. Dedicated caption container or active caption text elements exist in DOM
    if (document.querySelector('[jsname="dsyhDe"], .ygicle.VbkSUe, .ygicle, .VbkSUe')) {
      return true;
    }

    // 2. Check the CC toggle button state via Meet's stable identifiers (jsname or shortcut 'c')
    const ccBtn = document.querySelector<HTMLButtonElement>(
      'button[jsname="r8qRAd"], button[aria-keyshortcuts*="c"]'
    );
    if (ccBtn?.getAttribute('aria-pressed') === 'true') {
      return true;
    }

    return false;
  }

  public observe(
    onCaption: (caption: InterimCaption) => void,
    onCaptionsStateChange?: (enabled: boolean) => void
  ): void {
    this.onCaptionCallback = onCaption;
    this.onCaptionsStateChangeCallback = onCaptionsStateChange || null;

    this.stop();

    // 1. Observe DOM mutations for real-time responsiveness
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // 2. 300ms scanner loop as resilient fallback
    this.pollInterval = setInterval(() => {
      this.scanActiveCaptions();
      this.checkCaptionsState();
    }, 300);

    // Initial check
    this.checkCaptionsState();

    // Console diagnostic helper
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
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.onCaptionCallback) return;

    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement | Text;
      const el =
        target.nodeType === Node.ELEMENT_NODE ? (target as HTMLElement) : target.parentElement;

      if (!el || this.isExcluded(el)) continue;

      // Check if target matches caption text element directly or is inside one
      const textEl = el.closest<HTMLElement>(GoogleMeetAdapter.CAPTION_TEXT_SELECTORS.join(', '));
      if (!textEl || this.isExcluded(textEl)) continue;

      const text = textEl.textContent?.trim() || '';
      if (!this.isValidCaptionText(text)) continue;

      const speaker = this.extractSpeakerForTextElement(textEl);
      this.emitCaption(speaker, text);
    }
  }

  /**
   * Scans DOM directly for the latest active caption element
   */
  private scanActiveCaptions(): void {
    if (!this.onCaptionCallback) return;

    const latestEl = this.findLatestCaptionElement();
    if (!latestEl) return;

    const text = latestEl.textContent?.trim() || '';
    if (!this.isValidCaptionText(text)) return;

    const speaker = this.extractSpeakerForTextElement(latestEl);
    this.emitCaption(speaker, text);
  }

  private findLatestCaptionElement(): HTMLElement | null {
    const textEls = document.querySelectorAll<HTMLElement>(
      GoogleMeetAdapter.CAPTION_TEXT_SELECTORS.join(', ')
    );

    for (let i = textEls.length - 1; i >= 0; i--) {
      const el = textEls[i];
      if (!this.isExcluded(el)) {
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && this.isValidCaptionText(text)) {
          return el;
        }
      }
    }

    return null;
  }

  private emitCaption(speaker: string, text: string): void {
    const cleanText = text.trim();
    if (!cleanText || cleanText === this.lastCapturedText) return;

    this.lastCapturedText = cleanText;
    console.info(`[CaptionRecorder] CC Captured: [${speaker}] ${cleanText}`);

    this.onCaptionCallback?.({
      speaker: speaker.trim() || 'Speaker',
      text: cleanText,
      timestamp: Date.now(),
    });

    if (!this.lastKnownCaptionsEnabled) {
      this.lastKnownCaptionsEnabled = true;
      this.onCaptionsStateChangeCallback?.(true);
    }
  }

  private extractSpeakerForTextElement(textEl: HTMLElement): string {
    // 1. Check parent speech block for speaker selector
    const block =
      textEl.closest<HTMLElement>('[jsname="dsyhDe"] > div, .nMxHgf, [jscontroller="TEZ40e"]') ||
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

    // Filter out Material Icon ligature names (e.g. arrow_drop_down, mic_off)
    if (GoogleMeetAdapter.ICON_FONT_LIGATURES.includes(text.toLowerCase())) {
      return false;
    }

    return true;
  }

  private isExcluded(el: HTMLElement): boolean {
    if (!el) return true;

    for (const sel of GoogleMeetAdapter.EXCLUDE_SELECTORS) {
      if (el.closest(sel)) {
        return true;
      }
    }

    return false;
  }

  private checkCaptionsState(): void {
    const isEnabled = this.isCaptionsEnabled();
    if (isEnabled !== this.lastKnownCaptionsEnabled) {
      this.lastKnownCaptionsEnabled = isEnabled;
      this.onCaptionsStateChangeCallback?.(isEnabled);
    }
  }

  public runDiagnostics(): Record<string, unknown> {
    const textEls = Array.from(
      document.querySelectorAll(GoogleMeetAdapter.CAPTION_TEXT_SELECTORS.join(', '))
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
      lastCapturedText: this.lastCapturedText,
    };

    console.info('[CaptionRecorder Diagnostics]', result);
    return result;
  }
}
