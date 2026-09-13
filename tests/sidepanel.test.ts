import { browser } from 'wxt/browser';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  countWords,
  escapeHtml,
  formatElapsed,
  formatDuration,
  updateStatus,
  renderTranscript,
  updateActiveDraftTurn,
  appendTurnElement,
  updateTurnElement,
  showRecoveryBanner,
  hideRecoveryBanner,
  setupCloseButton,
  localizeUI,
  setupExportButtons,
  setCurrentSession,
  setCurrentStatus,
  setActiveDrafts,
  getScrollContainer,
  isNearBottom,
  scrollToBottom,
  setupNavigation,
} from '../src/entrypoints/sidepanel/main';
import type { MeetingSession, TranscriptSegment } from '../src/core/types';

describe('sidepanel/main.ts UI & Logic', () => {
  let domElements: Record<string, HTMLElement> = {};

  beforeEach(() => {
    domElements = {};

    const createMockElement = (tag = 'div', id = '', initialText = '') => {
      const children: HTMLElement[] = [];
      const el = {
        tagName: tag.toUpperCase(),
        id,
        textContent: initialText,
        className: '',
        classList: {
          toggle: vi.fn((cls: string, force?: boolean) => {
            const has = el.className.includes(cls);
            if (force === true || (force === undefined && !has)) {
              el.className = `${el.className} ${cls}`.trim();
            } else if (force === false || (force === undefined && has)) {
              el.className = el.className.replace(cls, '').trim();
            }
          }),
          add: vi.fn((cls: string) => {
            el.className = `${el.className} ${cls}`.trim();
          }),
          remove: vi.fn((cls: string) => {
            el.className = el.className.replace(cls, '').trim();
          }),
          contains: vi.fn((cls: string) => el.className.includes(cls)),
        },
        style: {} as Record<string, string>,
        children,
        scrollHeight: 500,
        scrollTop: 0,
        clientHeight: 400,
        parentElement: null as HTMLElement | null,
        closest: vi.fn((sel: string) => {
          let curr: HTMLElement | null = el as unknown as HTMLElement;
          while (curr) {
            if (sel.startsWith('.') && curr.className?.includes(sel.slice(1))) return curr;
            if (sel.startsWith('#') && curr.id === sel.slice(1)) return curr;
            curr = (curr as unknown as { parentElement: HTMLElement | null }).parentElement;
          }
          return null;
        }),
        appendChild: vi.fn((child: HTMLElement) => {
          children.push(child);
          (child as unknown as { parentElement: HTMLElement | null }).parentElement =
            el as unknown as HTMLElement;
          if (child.id) domElements[child.id] = child;
          return child;
        }),
        replaceChildren: vi.fn((...nodes: HTMLElement[]) => {
          children.length = 0;
          for (const node of nodes) {
            children.push(node);
            (node as unknown as { parentElement: HTMLElement | null }).parentElement =
              el as unknown as HTMLElement;
            if (node.id) domElements[node.id] = node;
          }
        }),
        remove: vi.fn(() => {
          if (id && domElements[id]) {
            delete domElements[id];
          }
        }),
        querySelector: vi.fn((sel: string) => {
          const findInNode = (node: HTMLElement): HTMLElement | null => {
            if (sel.includes('data-segment-id')) {
              const match = sel.match(/data-segment-id="([^"]+)"/);
              const segId = match ? match[1] : '';
              if (
                (node as unknown as { getAttribute: (k: string) => string }).getAttribute?.(
                  'data-segment-id'
                ) === segId
              ) {
                return node;
              }
            }
            if (sel.startsWith('.') && node.className?.includes(sel.slice(1))) {
              return node;
            }
            if (sel.startsWith('#') && node.id === sel.slice(1)) {
              return node;
            }
            for (const c of (node as unknown as { children?: HTMLElement[] }).children || []) {
              const res = findInNode(c);
              if (res) return res;
            }
            return null;
          };
          for (const c of children) {
            const found = findInNode(c);
            if (found) return found;
          }
          return null;
        }),
        querySelectorAll: vi.fn(() => children),
        setAttribute: vi.fn((name: string, val: string) => {
          (el as unknown as Record<string, unknown>)[name] = val;
        }),
        getAttribute: vi.fn((name: string) => (el as unknown as Record<string, unknown>)[name]),
        addEventListener: vi.fn(),
        get innerHTML() {
          const serialize = (node: HTMLElement): string => {
            const childHtml = ((node as unknown as { children?: HTMLElement[] }).children || [])
              .map(serialize)
              .join('');
            const text = node.textContent || '';
            const idAttr = node.id ? ` id="${node.id}"` : '';
            const classAttr = node.className ? ` class="${node.className}"` : '';
            return `<${(node.tagName || 'div').toLowerCase()}${idAttr}${classAttr}>${text}${childHtml}</${(node.tagName || 'div').toLowerCase()}>`;
          };
          return children.map(serialize).join('');
        },
        set innerHTML(val: string) {
          (el as unknown as Record<string, unknown>)._rawHtml = val;
        },
      } as unknown as HTMLElement;

      if (id) {
        domElements[id] = el;
      }
      return el;
    };

    const paneLive = createMockElement('section', 'pane-live');
    paneLive.className = 'pane-content';
    const transcriptList = createMockElement('div', 'transcript-list');
    paneLive.appendChild(transcriptList);

    createMockElement('div', 'status-pill');
    createMockElement('div', 'status-text');
    createMockElement('button', 'btn-new-meeting');
    createMockElement('button', 'btn-reset-session');
    createMockElement('span', 'val-duration');
    createMockElement('span', 'val-speakers');
    createMockElement('span', 'val-words');
    createMockElement('span', 'val-turns');
    createMockElement('div', 'sec-recovery');
    createMockElement('div', 'txt-recovery-desc');
    createMockElement('button', 'btn-close-sidepanel');
    createMockElement('span', 'txt-sponsor-btn');
    createMockElement('a', 'btn-sponsor-github');
    createMockElement('button', 'tab-btn-live');
    createMockElement('button', 'tab-btn-export');
    const paneExport = createMockElement('section', 'pane-export');
    paneExport.className = 'pane-content';

    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => domElements[id] || null,
      createElement: (tag: string) => createMockElement(tag),
      createElementNS: (_ns: string, tag: string) => createMockElement(tag),
    };

    (globalThis as unknown as Record<string, unknown>).chrome = {
      sidePanel: {},
      storage: {
        local: {
          get: vi.fn(async () => ({})),
        },
      },
    };

    setCurrentSession(null);
    setCurrentStatus('idle');
    setActiveDrafts([]);
  });

  describe('format helpers', () => {
    it('formats text, word count, and durations accurately', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('Hello world, testing words count')).toBe(5);
      expect(countWords('こんにちは世界')).toBeGreaterThan(0);

      expect(escapeHtml('<script>alert("XSS") & goodbye;</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;) &amp; goodbye;&lt;/script&gt;'
      );

      expect(formatElapsed(5000)).toBe('00:05');
      expect(formatElapsed(65000)).toBe('01:05');
      expect(formatElapsed(3665000)).toBe('01:01:05');

      expect(formatDuration(0)).toBe('0m 0s');
      expect(formatDuration(75000)).toBe('1m 15s');
    });
  });

  describe('updateStatus', () => {
    it('updates status pill and label across idle, recording, and paused states', () => {
      updateStatus('recording');
      expect(domElements['status-pill'].className).toBe('status-pill status-recording');
      expect(domElements['status-text'].textContent).toBe('Recording');

      updateStatus('paused');
      expect(domElements['status-pill'].className).toBe('status-pill status-paused');
      expect(domElements['status-text'].textContent).toBe('Paused');

      updateStatus('idle');
      expect(domElements['status-pill'].className).toBe('status-pill status-idle');
      expect(domElements['status-text'].textContent).toBe('Idle');
    });
  });

  describe('transcript rendering and incremental updates', () => {
    it('renders empty states for idle and active recording', () => {
      setCurrentSession(null);
      setCurrentStatus('idle');
      renderTranscript();
      expect(domElements['transcript-list'].innerHTML).toContain('empty-state');
      expect(domElements['transcript-list'].innerHTML).toContain('Ready for Meetings');

      setCurrentSession({
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      });
      setCurrentStatus('recording');
      renderTranscript();
      expect(domElements['transcript-list'].innerHTML).toContain('empty-state');
      expect(domElements['transcript-list'].innerHTML).toContain('Recording Captions');
    });

    it('incrementally appends new turn without wiping the list', () => {
      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      const segment: TranscriptSegment = {
        id: 'seg_1',
        speaker: 'Denis',
        startTime: 1050,
        endTime: 2000,
        text: 'Hello everyone',
      };
      session.segments.push(segment);

      appendTurnElement(segment);

      expect(domElements['transcript-list'].appendChild).toHaveBeenCalled();
      expect(domElements['val-words'].textContent).toBe('2');
      expect(domElements['val-speakers'].textContent).toBe('1');
      expect(domElements['val-turns'].textContent).toBe('1');
    });

    it('incrementally updates active speech draft without full re-render', () => {
      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      updateActiveDraftTurn([
        {
          speaker: 'Denis',
          text: 'Streaming interim speech',
          timestamp: 1500,
        },
      ]);

      expect(domElements['transcript-list'].appendChild).toHaveBeenCalled();
      expect(domElements['val-turns'].textContent).toBe('1');
      expect(domElements['val-words'].textContent).toBe('3');

      // Clear draft when silence/finalized
      updateActiveDraftTurn([]);
      expect(domElements['val-turns'].textContent).toBe('0');
      expect(domElements['val-words'].textContent).toBe('0');
    });

    it('renders multiple distinct pending active drafts without concatenation', () => {
      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      const draft1 = {
        speaker: 'Denis',
        text: 'Pre-last sentence',
        timestamp: 1500,
      };
      const draft2 = {
        speaker: 'Denis',
        text: 'Last sentence',
        timestamp: 1600,
      };

      updateActiveDraftTurn([draft1, draft2]);

      expect(domElements['val-turns'].textContent).toBe('2');
      expect(domElements['val-words'].textContent).toBe('5');

      // Clear drafts
      updateActiveDraftTurn([]);
      expect(domElements['val-turns'].textContent).toBe('0');
      expect(domElements['val-words'].textContent).toBe('0');
    });

    it('updates existing turn element in-place when revised', () => {
      const segment: TranscriptSegment = {
        id: 'seg_1',
        speaker: 'Alice',
        startTime: 1000,
        endTime: 2000,
        text: 'Original statement',
      };
      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [segment],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      appendTurnElement(segment);

      // Revised segment
      segment.text = 'Revised statement with more words';
      updateTurnElement(segment);

      expect(domElements['val-words'].textContent).toBe('5');
    });
  });

  describe('recovery banner', () => {
    it('displays and hides recovery banner', () => {
      const draft: MeetingSession = {
        id: 'd1',
        title: 'Saved Draft',
        startTime: 1000,
        endTime: 65000,
        platform: 'google-meet',
        segments: [
          { id: '1', speaker: 'Denis', startTime: 1000, endTime: 2000, text: 'Hi' },
          { id: '2', speaker: 'Bob', startTime: 2000, endTime: 3000, text: 'Hello' },
        ],
      };

      showRecoveryBanner(draft);
      expect(domElements['sec-recovery'].style.display).toBe('flex');
      expect(domElements['txt-recovery-desc'].textContent).toContain('2 turns');
      expect(domElements['txt-recovery-desc'].textContent).toContain('2 speakers');

      hideRecoveryBanner();
      expect(domElements['sec-recovery'].style.display).toBe('none');
    });
  });

  describe('setupCloseButton', () => {
    it('configures close button based on browser environment', () => {
      setupCloseButton();
      expect(domElements['btn-close-sidepanel'].style.display).toBe('none');

      // Firefox sidebar: visible with click listener
      domElements['btn-close-sidepanel'].style.display = '';
      const mockClose = vi.fn(async () => {});
      (browser as unknown as Record<string, unknown>).sidebarAction = {
        close: mockClose,
      };

      try {
        setupCloseButton();
        expect(domElements['btn-close-sidepanel'].style.display).not.toBe('none');
        expect(domElements['btn-close-sidepanel'].addEventListener).toHaveBeenCalledWith(
          'click',
          expect.any(Function)
        );
      } finally {
        delete (browser as unknown as { sidebarAction?: unknown }).sidebarAction;
      }
    });
  });

  describe('localizeUI', () => {
    it('localizes the sponsor button text and title', () => {
      localizeUI();
      expect(domElements['txt-sponsor-btn'].textContent).toBe('Sponsor on GitHub');
      expect((domElements['btn-sponsor-github'] as unknown as { title: string }).title).toBe(
        'Sponsor on GitHub'
      );
    });
  });

  describe('setupExportButtons', () => {
    it('attaches a click handler to the sponsor button to open GitHub Sponsors', () => {
      let clickHandler: (e: { preventDefault: () => void }) => void = () => {};
      domElements['btn-sponsor-github'].addEventListener = vi.fn(
        (event: string, handler: unknown) => {
          if (event === 'click') {
            clickHandler = handler as (e: { preventDefault: () => void }) => void;
          }
        }
      );

      const mockCreate = vi.fn();
      (browser as unknown as { tabs: { create: typeof mockCreate } }).tabs = {
        create: mockCreate,
      };

      setupExportButtons();

      expect(domElements['btn-sponsor-github'].addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      const preventDefault = vi.fn();
      clickHandler?.({ preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({
        url: 'https://github.com/sponsors/denisglotov',
      });
    });
  });

  describe('autoscroll and scroll container handling', () => {
    it('detects the appropriate scroll container', () => {
      expect(getScrollContainer(domElements['transcript-list'])).toBe(domElements['pane-live']);
      expect(getScrollContainer(null)).toBe(domElements['pane-live']);

      // Fallback when pane-live is missing
      const standaloneList = {
        parentElement: null,
        closest: vi.fn(() => null),
      } as unknown as HTMLElement;
      delete domElements['pane-live'];
      expect(getScrollContainer(standaloneList)).toBe(standaloneList);
    });

    it('determines if container is near bottom accurately based on threshold', () => {
      const container = {
        scrollHeight: 1000,
        scrollTop: 600,
        clientHeight: 400,
      } as HTMLElement;

      // Distance from bottom is 1000 - 600 - 400 = 0 (< 120)
      expect(isNearBottom(container)).toBe(true);

      // Distance is 1000 - 550 - 400 = 50 (< 120)
      container.scrollTop = 550;
      expect(isNearBottom(container)).toBe(true);

      // Distance is 1000 - 400 - 400 = 200 (>= 120) -> scrolled up
      container.scrollTop = 400;
      expect(isNearBottom(container)).toBe(false);

      expect(isNearBottom(null)).toBe(true);
    });

    it('scrolls container and fallback list to bottom with scrollToBottom', () => {
      const container = {
        scrollHeight: 1000,
        scrollTop: 0,
      } as HTMLElement;
      const list = {
        scrollHeight: 1000,
        scrollTop: 0,
      } as HTMLElement;

      scrollToBottom(container, list);
      expect(container.scrollTop).toBe(1000);
      expect(list.scrollTop).toBe(1000);
    });

    const setElementGeometry = (el: HTMLElement, scrollHeight: number, clientHeight: number) => {
      Object.defineProperty(el, 'scrollHeight', {
        value: scrollHeight,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(el, 'clientHeight', {
        value: clientHeight,
        configurable: true,
        writable: true,
      });
    };

    it('scrolls pane-live to bottom when appending a new turn while near bottom', () => {
      const pane = domElements['pane-live'];
      setElementGeometry(pane, 1000, 400);
      pane.scrollTop = 600; // at bottom (1000 - 600 - 400 = 0)

      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      const segment: TranscriptSegment = {
        id: 'seg_1',
        speaker: 'Alice',
        startTime: 1050,
        endTime: 2000,
        text: 'New statement',
      };

      appendTurnElement(segment);

      expect(pane.scrollTop).toBe(pane.scrollHeight);
    });

    it('preserves scroll position when user scrolled up and a new turn arrives', () => {
      const pane = domElements['pane-live'];
      setElementGeometry(pane, 2000, 400);
      pane.scrollTop = 500; // user scrolled up (2000 - 500 - 400 = 1100 >= 120)

      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      const segment: TranscriptSegment = {
        id: 'seg_2',
        speaker: 'Bob',
        startTime: 2050,
        endTime: 3000,
        text: 'Another statement',
      };

      appendTurnElement(segment);

      expect(pane.scrollTop).toBe(500); // Unchanged!
    });

    it('scrolls pane-live to bottom when active draft streams while near bottom', () => {
      const pane = domElements['pane-live'];
      setElementGeometry(pane, 1200, 400);
      pane.scrollTop = 800; // at bottom

      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');

      updateActiveDraftTurn([
        {
          speaker: 'Alice',
          text: 'Live caption words...',
          timestamp: 2500,
        },
      ]);

      expect(pane.scrollTop).toBe(pane.scrollHeight);
    });

    it('scrolls pane-live to bottom when updating an existing turn while near bottom', () => {
      const pane = domElements['pane-live'];
      setElementGeometry(pane, 1200, 400);
      pane.scrollTop = 800; // at bottom

      const segment: TranscriptSegment = {
        id: 'seg_upd',
        speaker: 'Alice',
        startTime: 1000,
        endTime: 2000,
        text: 'Initial sentence',
      };
      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [segment],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('recording');
      appendTurnElement(segment);

      pane.scrollTop = 800;
      segment.text = 'Initial sentence extended with more words as speech continues';
      updateTurnElement(segment);

      expect(pane.scrollTop).toBe(pane.scrollHeight);
    });

    it('force scrolls to bottom on renderTranscript(true)', () => {
      const pane = domElements['pane-live'];
      setElementGeometry(pane, 1500, 400);
      pane.scrollTop = 100; // user was scrolled up

      const session: MeetingSession = {
        id: 's1',
        title: 'Meeting',
        startTime: 1000,
        segments: [{ id: '1', speaker: 'Denis', startTime: 1000, endTime: 2000, text: 'Hi' }],
        platform: 'google-meet',
      };
      setCurrentSession(session);
      setCurrentStatus('idle');

      renderTranscript(true);

      expect(pane.scrollTop).toBe(pane.scrollHeight);
    });

    it('preserves or restores scroll state when navigating between tabs', () => {
      const pane = domElements['pane-live'];
      const paneExport = domElements['pane-export'];
      const tabLive = domElements['tab-btn-live'];
      const tabExport = domElements['tab-btn-export'];

      setElementGeometry(pane, 2000, 400);
      pane.scrollTop = 500; // user was scrolled up reading history

      setupNavigation();

      // Find click handlers attached to tabs
      const exportClickHandler = (
        tabExport.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: unknown[]) => call[0] === 'click')?.[1];
      const liveClickHandler = (
        tabLive.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find((call: unknown[]) => call[0] === 'click')?.[1];

      // Switch to export tab
      exportClickHandler?.();
      expect(pane.style.display).toBe('none');
      expect(paneExport.style.display).toBe('block');

      // Simulate browser resetting scrollTop when hidden
      pane.scrollTop = 0;

      // Switch back to live tab
      liveClickHandler?.();
      expect(pane.style.display).toBe('block');
      expect(pane.scrollTop).toBe(500); // Restored!
    });
  });
});
