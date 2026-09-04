import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleMeetAdapter } from '../src/adapters/GoogleMeetAdapter';
import type { InterimCaption } from '../src/core/types';

describe('GoogleMeetAdapter Author Chunk Switching', () => {
  let adapter: GoogleMeetAdapter;
  let originalDocument: unknown;
  let originalMutationObserver: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    originalDocument = (globalThis as unknown as { document?: unknown }).document;
    originalMutationObserver = (globalThis as unknown as { MutationObserver?: unknown })
      .MutationObserver;

    (globalThis as unknown as { document: unknown }).document = {
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      body: {},
    };

    (globalThis as unknown as { MutationObserver: unknown }).MutationObserver = class {
      observe() {}
      disconnect() {}
    };

    adapter = new GoogleMeetAdapter();
  });

  afterEach(() => {
    adapter.stop();
    vi.useRealTimers();
    if (originalDocument !== undefined) {
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    } else {
      delete (globalThis as unknown as { document?: unknown }).document;
    }
    if (originalMutationObserver !== undefined) {
      (globalThis as unknown as { MutationObserver: unknown }).MutationObserver =
        originalMutationObserver;
    } else {
      delete (globalThis as unknown as { MutationObserver?: unknown }).MutationObserver;
    }
    vi.restoreAllMocks();
  });

  function createMockCaptionElement(initialText: string, speakerName: string) {
    const block = {
      tagName: 'DIV',
      querySelector: (selector: string) => {
        if (selector.includes('NWpY1d')) {
          return { textContent: speakerName };
        }
        return null;
      },
      getAttribute: () => null,
      closest: () => null,
      isConnected: true,
    };

    const textEl = {
      tagName: 'DIV',
      textContent: initialText,
      closest: (sel: string) => {
        if (
          sel.includes('dsyhDe') ||
          sel.includes('nMcdL') ||
          sel.includes('bj4p3b') ||
          sel.includes('nMxHgf') ||
          sel.includes('TEZ40e')
        ) {
          return block;
        }
        if (sel.includes('ygicle')) {
          return textEl;
        }
        return null;
      },
      querySelector: () => null,
      parentElement: block,
      isConnected: true,
    };

    return { block, textEl };
  }

  it('keeps intermediate speech drafts pending within the same chunk element and does not emit prematurely', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl } = createMockCaptionElement('Cuan.', 'You');

    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    expect(emitted.length).toBe(0);

    // Rapid live translation drafts inside the same chunk element
    textEl.textContent = 'Cuanto.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    textEl.textContent = 'Cuanto three, four, five, six, seven.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    textEl.textContent = '1, 2, 3, 4, 5, 6, 7.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    // No chunk switch has occurred yet
    expect(emitted.length).toBe(0);
  });

  it('streams the current unstable chunk via onActiveCaption in real-time before switching', () => {
    const emittedFinals: InterimCaption[] = [];
    const activeDrafts: (InterimCaption | null)[] = [];

    adapter.observe(
      (cap) => emittedFinals.push(cap),
      undefined,
      (active) => activeDrafts.push(active)
    );

    const { textEl: chunk1 } = createMockCaptionElement('Hello', 'Denis');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );

    // Initial unstable chunk
    expect(activeDrafts.length).toBe(1);
    expect(activeDrafts[0]?.speaker).toBe('Denis');
    expect(activeDrafts[0]?.text).toBe('Hello');
    expect(emittedFinals.length).toBe(0);

    // Draft update in progress
    chunk1.textContent = 'Hello world';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );

    expect(activeDrafts.length).toBe(2);
    expect(activeDrafts[1]?.text).toBe('Hello world');
    expect(emittedFinals.length).toBe(0);

    // Author switches to next chunk
    const { textEl: chunk2 } = createMockCaptionElement('Next sentence', 'Denis');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );

    // First chunk is finalized
    expect(emittedFinals.length).toBe(1);
    expect(emittedFinals[0].text).toBe('Hello world');

    // Second chunk is now the active draft
    expect(activeDrafts[activeDrafts.length - 1]?.text).toBe('Next sentence');
  });

  it('emits previous caption chunk immediately when the author switches to a new caption chunk (div) without waiting for timers', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    // Author "You" speaks first chunk
    const { textEl: chunk1 } = createMockCaptionElement('First sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );
    expect(emitted.length).toBe(0);

    // Author "You" begins second chunk div
    const { textEl: chunk2 } = createMockCaptionElement('Second sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );

    // First chunk emits IMMEDIATELY (0ms delay)
    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('First sentence spoken.');

    // Second chunk is currently pending
    expect(emitted.find((c) => c.text === 'Second sentence spoken.')).toBeUndefined();

    // Author "You" begins third chunk div
    const { textEl: chunk3 } = createMockCaptionElement('Third sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk3
    );

    // Second chunk emits immediately
    expect(emitted.length).toBe(2);
    expect(emitted[1].speaker).toBe('You');
    expect(emitted[1].text).toBe('Second sentence spoken.');
  });

  it('flushes pending caption immediately when speaker changes', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    // Speaker 1: You
    const { textEl: text1 } = createMockCaptionElement('Speaking first', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text1
    );
    expect(emitted.length).toBe(0);

    // Speaker 2: Bob starts speaking
    const { textEl: text2 } = createMockCaptionElement('Speaking second', 'Bob');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text2
    );

    // Speaker 1 should be immediately flushed with 0ms delay
    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('Speaking first');

    // Flush on stop/pause captures Bob
    adapter.flush();
    expect(emitted.length).toBe(2);
    expect(emitted[1].speaker).toBe('Bob');
    expect(emitted[1].text).toBe('Speaking second');
  });

  it('does not re-emit unchanged lingering captions while element remains in DOM', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl } = createMockCaptionElement('Full final poem text recited by speaker.', 'You');

    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Full final poem text recited by speaker.');

    // Scanner continues polling the unchanged element
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    // Should NOT emit duplicates
    expect(emitted.length).toBe(1);
  });

  it('immediately flushes pending caption when flush() is invoked on stop or pause', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl } = createMockCaptionElement('Sentence in progress', 'Alice');

    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    expect(emitted.length).toBe(0);

    adapter.flush();

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('Alice');
    expect(emitted[0].text).toBe('Sentence in progress');
  });

  it('emits pending caption chunk when caption element is disconnected from the DOM', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl } = createMockCaptionElement('Closing remarks before clearing.', 'You');

    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    expect(emitted.length).toBe(0);

    // Google Meet clears the caption on silence -> disconnected from DOM
    textEl.isConnected = false;

    // Next scan or mutation checks element connection
    (adapter as unknown as { scanActiveCaptions: () => void }).scanActiveCaptions();

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('Closing remarks before clearing.');
  });

  it('scans multiple caption chunks in DOM in sequence, finalizing earlier chunks and keeping last chunk pending', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl: chunk1 } = createMockCaptionElement('Paragraph 1', 'Denis');
    const { textEl: chunk2 } = createMockCaptionElement('Paragraph 2 in progress', 'Denis');

    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn(() => [chunk1, chunk2]);

    (adapter as unknown as { scanActiveCaptions: () => void }).scanActiveCaptions();

    // Chunk 1 switched to Chunk 2 and is finalized
    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Paragraph 1');

    // Subsequent scan with no new chunks does not emit Chunk 2 while still active
    (adapter as unknown as { scanActiveCaptions: () => void }).scanActiveCaptions();
    expect(emitted.length).toBe(1);

    // On stop/flush, Chunk 2 is finalized
    adapter.flush();
    expect(emitted.length).toBe(2);
    expect(emitted[1].text).toBe('Paragraph 2 in progress');
  });

  it('correctly detects CC enabled via caption text presence or button aria-pressed', () => {
    // Neither present
    expect(adapter.isCaptionsEnabled()).toBe(false);

    // Visible caption text element present
    (
      globalThis as unknown as { document: { querySelector: unknown; querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('ygicle')) {
        return [
          {
            textContent: 'Live caption text in call',
            offsetWidth: 120,
            offsetHeight: 24,
            closest: () => null,
          },
        ];
      }
      return [];
    });
    expect(adapter.isCaptionsEnabled()).toBe(true);

    // Button aria-pressed="true"
    const pressedTrueBtn = {
      getAttribute: (attr: string) => (attr === 'aria-pressed' ? 'true' : null),
      textContent: '',
      closest: () => null,
    };
    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('r8qRAd') || sel.includes('aria-keyshortcuts')) {
        return [pressedTrueBtn];
      }
      return [];
    });
    expect(adapter.isCaptionsEnabled()).toBe(true);

    // Button aria-pressed="false"
    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('r8qRAd')) {
        return [
          {
            getAttribute: (attr: string) => (attr === 'aria-pressed' ? 'false' : null),
            textContent: '',
            closest: () => null,
          },
        ];
      }
      return [];
    });
    expect(adapter.isCaptionsEnabled()).toBe(false);

    // Button with icon text closed_caption (active)
    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('r8qRAd')) {
        return [{ getAttribute: () => null, textContent: 'closed_caption', closest: () => null }];
      }
      return [];
    });
    expect(adapter.isCaptionsEnabled()).toBe(true);

    // Button with icon text closed_caption_off (inactive)
    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('r8qRAd')) {
        return [
          { getAttribute: () => null, textContent: 'closed_caption_off', closest: () => null },
        ];
      }
      return [];
    });
    expect(adapter.isCaptionsEnabled()).toBe(false);
  });

  it('notifies onCaptionsStateChange and flushes pending speech when CC is disabled', () => {
    let isCCEnabled = true;
    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('r8qRAd')) {
        return [
          {
            getAttribute: (attr: string) => (attr === 'aria-pressed' ? String(isCCEnabled) : null),
            closest: () => null,
          },
        ];
      }
      return [];
    });

    const emitted: InterimCaption[] = [];
    const stateChanges: boolean[] = [];

    adapter.observe(
      (cap) => emitted.push(cap),
      (enabled) => stateChanges.push(enabled)
    );

    // Initial check fired enabled: true
    expect(stateChanges).toEqual([true]);

    // Add a pending caption
    const { textEl } = createMockCaptionElement('Speech before user turns off CC', 'Denis');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    expect(emitted.length).toBe(0);

    // CC is turned off in Meet
    isCCEnabled = false;
    (adapter as unknown as { checkCaptionsState: () => void }).checkCaptionsState();

    expect(stateChanges).toEqual([true, false]);
    // Speech before turn off was flushed!
    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Speech before user turns off CC');
  });

  it('matches valid meeting room URLs and rejects non-meeting pages', () => {
    expect(adapter.matchesUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(adapter.matchesUrl('https://meet.google.com/_meet/abc-defg-hij')).toBe(true);
    expect(adapter.matchesUrl('https://meet.google.com/lookup/team-standup')).toBe(true);
    expect(adapter.matchesUrl('https://meet.google.com/')).toBe(false);
    expect(adapter.matchesUrl('https://meet.google.com/landing')).toBe(false);
    expect(adapter.matchesUrl('https://google.com')).toBe(false);
  });

  it('determines if two URLs belong to the same meeting room', () => {
    expect(
      adapter.isSameMeeting(
        'https://meet.google.com/abc-defg-hij',
        'https://meet.google.com/abc-defg-hij?authuser=1'
      )
    ).toBe(true);
    expect(
      adapter.isSameMeeting(
        'https://meet.google.com/abc-defg-hij',
        'https://meet.google.com/xyz-uvwx-rst'
      )
    ).toBe(false);
    expect(
      adapter.isSameMeeting(
        'https://meet.google.com/abc-defg-hij',
        'https://meet.google.com/landing'
      )
    ).toBe(false);
  });

  it('tracks speech startTime on pending captions and preserves it when finalized', () => {
    const emitted: InterimCaption[] = [];
    const activeDrafts: (InterimCaption | null)[] = [];

    adapter.observe(
      (cap) => emitted.push(cap),
      undefined,
      (active) => activeDrafts.push(active)
    );

    const { textEl } = createMockCaptionElement('Start of speech', 'Denis');

    vi.setSystemTime(10000);
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    expect(activeDrafts[0]?.startTime).toBe(10000);

    // Evolve draft 500ms later
    vi.setSystemTime(10500);
    textEl.textContent = 'Start of speech continuing';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );

    expect(activeDrafts[1]?.startTime).toBe(10000);
    expect(activeDrafts[1]?.timestamp).toBe(10500);

    // Flush at 11000ms
    vi.setSystemTime(11000);
    adapter.flush();

    expect(emitted.length).toBe(1);
    expect(emitted[0].startTime).toBe(10000);
    expect(emitted[0].timestamp).toBe(11000);
  });

  it('re-emits updated caption with same id when Google Meet revises an already-finalized phrase (e.g. Japanese recognition revision from は関連。 to ありがとうございます。)', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl: chunk1 } = createMockCaptionElement('は関連。', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );

    // Second chunk arrives (e.g. "Hello!"), flushing chunk1
    const { textEl: chunk2 } = createMockCaptionElement('Hello!', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('は関連。');
    const firstTurnId = emitted[0].id;
    expect(firstTurnId).toBeDefined();

    // Google Meet's Japanese ASR refines chunk1's text in the DOM
    chunk1.textContent = ' ありがとうございます。 ';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );

    // Should emit an update with the exact same turn ID
    expect(emitted.length).toBe(2);
    expect(emitted[1].id).toBe(firstTurnId);
    expect(emitted[1].speaker).toBe('You');
    expect(emitted[1].text).toBe('ありがとうございます。');

    // Subsequent poll with unchanged text does not emit duplicate
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );
    expect(emitted.length).toBe(2);
  });

  it('does not treat Jump to most recent captions button as caption toggle button', () => {
    const jumpBtn = {
      tagName: 'BUTTON',
      getAttribute: (attr: string) =>
        attr === 'aria-label' ? 'Jump to most recent captions' : null,
      textContent: 'Jump to bottom',
      closest: (sel: string) => (sel.includes('vNKgIf') || sel.includes('IMKgW') ? {} : null),
    };

    (
      globalThis as unknown as { document: { querySelector: unknown; querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn((sel: string) => {
      if (sel.includes('aria-label*="caption"')) {
        return [jumpBtn];
      }
      return [];
    });
    (globalThis as unknown as { document: { querySelector: unknown } }).document.querySelector =
      vi.fn((sel: string) => {
        if (sel.includes('caption')) return jumpBtn;
        return null;
      });

    expect(adapter.findCaptionButton()).toBeNull();
  });
});
