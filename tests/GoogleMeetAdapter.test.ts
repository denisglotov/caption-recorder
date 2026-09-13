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

    // Author switches to second chunk: both chunks 1 and 2 are pending
    const { textEl: chunk2 } = createMockCaptionElement('Next sentence', 'Denis');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );

    expect(emittedFinals.length).toBe(0);
    expect(activeDrafts[activeDrafts.length - 1]?.text).toBe('Hello world Next sentence');

    // Author reaches third chunk: third-from-last (chunk 1) is now finalized
    const { textEl: chunk3 } = createMockCaptionElement('Third sentence', 'Denis');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk3
    );

    expect(emittedFinals.length).toBe(1);
    expect(emittedFinals[0].text).toBe('Hello world');
    expect(activeDrafts[activeDrafts.length - 1]?.text).toBe('Next sentence Third sentence');

    // Flush finalizes remaining pending chunks
    adapter.flush();
    expect(emittedFinals.length).toBe(3);
    expect(emittedFinals[1].text).toBe('Next sentence');
    expect(emittedFinals[2].text).toBe('Third sentence');
  });

  it('emits previous caption chunk immediately when author reaches 3 chunks without waiting for timers', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    // Author "You" speaks first chunk
    const { textEl: chunk1 } = createMockCaptionElement('First sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk1
    );
    expect(emitted.length).toBe(0);

    // Author "You" begins second chunk div: both pending
    const { textEl: chunk2 } = createMockCaptionElement('Second sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );
    expect(emitted.length).toBe(0);

    // Author "You" begins third chunk div: chunk 1 is finalized immediately
    const { textEl: chunk3 } = createMockCaptionElement('Third sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk3
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('First sentence spoken.');

    // Author "You" begins fourth chunk div: chunk 2 is finalized immediately
    const { textEl: chunk4 } = createMockCaptionElement('Fourth sentence spoken.', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk4
    );

    expect(emitted.length).toBe(2);
    expect(emitted[1].speaker).toBe('You');
    expect(emitted[1].text).toBe('Second sentence spoken.');

    // Flush captures remaining pending chunks (chunks 3 and 4)
    adapter.flush();
    expect(emitted.length).toBe(4);
    expect(emitted[2].text).toBe('Third sentence spoken.');
    expect(emitted[3].text).toBe('Fourth sentence spoken.');
  });

  it('supports N concurrent speakers without prematurely finalizing one speaker when another speaks', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    // Speaker 1: You
    const { textEl: text1 } = createMockCaptionElement('Speaking first', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text1
    );
    expect(emitted.length).toBe(0);

    // Speaker 2: Bob starts speaking concurrently
    const { textEl: text2 } = createMockCaptionElement('Speaking second', 'Bob');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text2
    );

    // Speaker 1 is NOT prematurely flushed; both You and Bob are concurrently pending
    expect(emitted.length).toBe(0);

    // Speaker 1 speaks a second chunk: both You chunks are pending, Bob still pending
    const { textEl: text3 } = createMockCaptionElement('Speaking third', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text3
    );
    expect(emitted.length).toBe(0);

    // Speaker 1 speaks a third chunk: You's first chunk is finalized, Bob remains pending
    const { textEl: text4 } = createMockCaptionElement('Speaking fourth', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      text4
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('You');
    expect(emitted[0].text).toBe('Speaking first');

    // Flush on stop/pause captures Bob and You's remaining chunks
    adapter.flush();
    expect(emitted.length).toBe(4);
    expect(emitted.some((c) => c.speaker === 'Bob' && c.text === 'Speaking second')).toBe(true);
    expect(emitted.some((c) => c.speaker === 'You' && c.text === 'Speaking third')).toBe(true);
    expect(emitted.some((c) => c.speaker === 'You' && c.text === 'Speaking fourth')).toBe(true);
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

  it('scans multiple caption chunks in DOM in sequence, finalizing earlier chunks and keeping last 2 chunks pending', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl: chunk1 } = createMockCaptionElement('Paragraph 1', 'Denis');
    const { textEl: chunk2 } = createMockCaptionElement('Paragraph 2', 'Denis');
    const { textEl: chunk3 } = createMockCaptionElement('Paragraph 3 in progress', 'Denis');

    (
      globalThis as unknown as { document: { querySelectorAll: unknown } }
    ).document.querySelectorAll = vi.fn(() => [chunk1, chunk2, chunk3]);

    (adapter as unknown as { scanActiveCaptions: () => void }).scanActiveCaptions();

    // Chunk 1 is 3rd-from-last and is finalized
    expect(emitted.length).toBe(1);
    expect(emitted[0].text).toBe('Paragraph 1');

    // Subsequent scan with no new chunks does not emit duplicates
    (adapter as unknown as { scanActiveCaptions: () => void }).scanActiveCaptions();
    expect(emitted.length).toBe(1);

    // On stop/flush, Chunks 2 & 3 are finalized
    adapter.flush();
    expect(emitted.length).toBe(3);
    expect(emitted[1].text).toBe('Paragraph 2');
    expect(emitted[2].text).toBe('Paragraph 3 in progress');
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
    expect(adapter.matchesUrl('https://meet.google.com/call/abc123xyz')).toBe(true);
    expect(adapter.matchesUrl('https://meet.google.com/call/abc-def-ghi?authuser=0')).toBe(true);
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

    const { textEl: chunk2 } = createMockCaptionElement('Hello!', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk2
    );

    const { textEl: chunk3 } = createMockCaptionElement('Continuing speech...', 'You');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      chunk3
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

  it('creates a new turn when a caption container is reused by a different speaker', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    const { textEl, block } = createMockCaptionElement('Speaker 1 remarks.', 'Alice');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('Alice');
    expect(emitted[0].text).toBe('Speaker 1 remarks.');
    const firstTurnId = emitted[0].id;

    // Meet reuses the same DOM container block for Bob
    textEl.textContent = 'Speaker 2 starts talking in same container.';
    block.querySelector = (sel: string) => {
      if (sel.includes('NWpY1d')) return { textContent: 'Bob' };
      return null;
    };

    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(2);
    expect(emitted[1].id).not.toBe(firstTurnId);
    expect(emitted[1].speaker).toBe('Bob');
    expect(emitted[1].text).toBe('Speaker 2 starts talking in same container.');
  });

  it('creates a new turn when the same speaker speaks again in the same container after a time gap', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    vi.setSystemTime(100000);
    const { textEl } = createMockCaptionElement('First sentence.', 'Alice');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(1);
    const firstTurnId = emitted[0].id;

    // 20 seconds later, same container is updated with a completely disjoint new sentence
    vi.setSystemTime(120000);
    textEl.textContent = 'Second sentence spoken 20 seconds later.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(2);
    expect(emitted[1].id).not.toBe(firstTurnId);
    expect(emitted[1].text).toBe('Second sentence spoken 20 seconds later.');
  });

  it('updates turn when a long monologue is extended with trailing words', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    vi.setSystemTime(100000);
    const { textEl } = createMockCaptionElement('Initial monologue section.', 'Alice');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(1);

    // 35 seconds later (> 15s limit), trailing words are added to the existing speech container
    vi.setSystemTime(135000);
    textEl.textContent = 'Initial monologue section. Extended with more thoughts 35s later.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(2);
    expect(emitted[1].speaker).toBe('Alice');
    expect(emitted[1].text).toBe(
      'Initial monologue section. Extended with more thoughts 35s later.'
    );
  });

  it('updates turn when ASR refines words on a long turn', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    vi.setSystemTime(100000);
    const { textEl } = createMockCaptionElement(
      'Тогда я хотел прям по быстренько пройтись реклама в играх оплата их.',
      'You'
    );
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(1);

    // 40 seconds later, Meet ASR refines the ending of the sentence
    vi.setSystemTime(140000);
    textEl.textContent =
      'Тогда я хотел прям по быстренько пройтись реклама в играх и оплаты. Я может';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      textEl
    );
    adapter.flush();

    expect(emitted.length).toBe(2);
    expect(emitted[1].text).toBe(
      'Тогда я хотел прям по быстренько пройтись реклама в играх и оплаты. Я может'
    );
  });

  it('handles multi-speaker interjections without duplicating speech turns', () => {
    const emitted: InterimCaption[] = [];
    adapter.observe((cap) => emitted.push(cap));

    vi.setSystemTime(100000);
    const { textEl: aliceEl } = createMockCaptionElement(
      'Alice begins speaking her thought.',
      'Alice'
    );
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      aliceEl
    );

    // Bob interjects concurrently
    vi.setSystemTime(102000);
    const { textEl: bobEl } = createMockCaptionElement('Quick interjection.', 'Bob');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      bobEl
    );

    // Both Alice and Bob are concurrently pending; Alice is NOT prematurely flushed
    expect(emitted.length).toBe(0);

    // Alice continues her thought in her container (extended text)
    vi.setSystemTime(104000);
    aliceEl.textContent = 'Alice begins speaking her thought. And here is the conclusion.';
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      aliceEl
    );

    // Still pending without premature flush
    expect(emitted.length).toBe(0);

    // Alice starts a second chunk: both Alice chunks are pending, Bob still pending
    vi.setSystemTime(106000);
    const { textEl: aliceEl2 } = createMockCaptionElement('Alice begins next thought.', 'Alice');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      aliceEl2
    );

    expect(emitted.length).toBe(0);

    // Alice starts a third chunk: Alice's first thought is now finalized
    vi.setSystemTime(108000);
    const { textEl: aliceEl3 } = createMockCaptionElement('Alice reaches third thought.', 'Alice');
    (adapter as unknown as { processCaptionElement: (el: unknown) => void }).processCaptionElement(
      aliceEl3
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].speaker).toBe('Alice');
    expect(emitted[0].text).toBe('Alice begins speaking her thought. And here is the conclusion.');

    // Bob's speech and Alice's remaining thoughts are finalized on flush
    adapter.flush();
    expect(emitted.length).toBe(4);
    expect(emitted.some((c) => c.speaker === 'Bob' && c.text === 'Quick interjection.')).toBe(true);
    expect(
      emitted.some((c) => c.speaker === 'Alice' && c.text === 'Alice begins next thought.')
    ).toBe(true);
    expect(
      emitted.some((c) => c.speaker === 'Alice' && c.text === 'Alice reaches third thought.')
    ).toBe(true);
  });
});
