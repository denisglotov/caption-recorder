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
  setActiveDraft,
} from '../src/entrypoints/sidepanel/main';
import type { MeetingSession, TranscriptSegment } from '../src/core/types';

describe('sidepanel/main.ts UI & Logic', () => {
  let domElements: Record<string, HTMLElement> = {};

  beforeEach(() => {
    domElements = {};

    const createElement = (id: string, initialText = '') => {
      const children: HTMLElement[] = [];
      const el = {
        id,
        textContent: initialText,
        className: '',
        style: {} as Record<string, string>,
        innerHTML: '',
        children,
        scrollHeight: 500,
        scrollTop: 0,
        clientHeight: 400,
        appendChild: vi.fn((child: HTMLElement) => {
          children.push(child);
          domElements[child.id || `el_${Math.random()}`] = child;
          return child;
        }),
        remove: vi.fn(),
        querySelector: vi.fn((sel: string) => {
          if (sel.includes('data-segment-id')) {
            const match = sel.match(/data-segment-id="([^"]+)"/);
            const segId = match ? match[1] : '';
            return (
              children.find(
                (c) =>
                  (c as unknown as { getAttribute: (k: string) => string }).getAttribute?.(
                    'data-segment-id'
                  ) === segId
              ) || null
            );
          }
          return null;
        }),
        querySelectorAll: vi.fn(() => children),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        addEventListener: vi.fn(),
      } as unknown as HTMLElement;
      domElements[id] = el;
      return el;
    };

    createElement('transcript-list');
    createElement('status-pill');
    createElement('status-text');
    createElement('btn-new-meeting');
    createElement('btn-reset-session');
    createElement('val-duration');
    createElement('val-speakers');
    createElement('val-words');
    createElement('val-turns');
    createElement('sec-recovery');
    createElement('txt-recovery-desc');
    createElement('btn-close-sidepanel');
    createElement('txt-sponsor-btn');
    createElement('btn-sponsor-github');

    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => domElements[id] || null,
      createElement: (tag: string) => {
        const el = {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          innerHTML: '',
          textContent: '',
          setAttribute: vi.fn((name: string, val: string) => {
            (el as unknown as Record<string, unknown>)[name] = val;
          }),
          getAttribute: vi.fn((name: string) => (el as unknown as Record<string, unknown>)[name]),
          remove: vi.fn(),
        } as unknown as HTMLElement;
        return el;
      },
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
    setActiveDraft(null);
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

      updateActiveDraftTurn({
        speaker: 'Denis',
        text: 'Streaming interim speech',
        timestamp: 1500,
      });

      expect(domElements['transcript-list'].appendChild).toHaveBeenCalled();
      expect(domElements['val-turns'].textContent).toBe('1');
      expect(domElements['val-words'].textContent).toBe('3');

      // Clear draft when silence/finalized
      updateActiveDraftTurn(null);
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
});
