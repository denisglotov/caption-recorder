import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamReconciler } from '../src/core/StreamReconciler';

describe('StreamReconciler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('reconcileText static algorithm', () => {
    it('returns incoming if current is empty', () => {
      expect(StreamReconciler.reconcileText('', 'Hello world')).toBe('Hello world');
    });

    it('returns current if incoming is empty', () => {
      expect(StreamReconciler.reconcileText('Hello world', '')).toBe('Hello world');
    });

    it('handles direct extensions without stutter', () => {
      const cur = 'We are discussing';
      const inc = 'We are discussing the project';
      expect(StreamReconciler.reconcileText(cur, inc)).toBe('We are discussing the project');
    });

    it('reconciles multi-word suffix-prefix overlap', () => {
      const cur = 'The team needs to complete the';
      const inc = 'complete the quarterly goals by Friday';
      expect(StreamReconciler.reconcileText(cur, inc)).toBe(
        'The team needs to complete the quarterly goals by Friday'
      );
    });

    it('normalizes punctuation when finding word overlap', () => {
      const cur = 'Welcome to the meeting,';
      const inc = 'the meeting today everyone';
      expect(StreamReconciler.reconcileText(cur, inc)).toBe(
        'Welcome to the meeting today everyone'
      );
    });

    it('reconciles CJK character-level overlap without spaces', () => {
      const cur = '本日の会議を始め';
      const inc = '会議を始めさせていただきます';
      expect(StreamReconciler.reconcileText(cur, inc)).toBe('本日の会議を始めさせていただきます');
    });

    it('handles progressive digit counting without duplicates', () => {
      let text = '6';
      text = StreamReconciler.reconcileText(text, '6 7');
      expect(text).toBe('6 7');
      text = StreamReconciler.reconcileText(text, '6 7 8 9 10');
      expect(text).toBe('6 7 8 9 10');
    });

    it('handles live in-progress sentence revisions without duplicating prefixes', () => {
      const chunks = [
        'а раз два, три, 4, 5',
        'Раз два три четыре пять вышел зайчик погулять, Вдруг охот',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбе.',
        'Раз два три четыре пять Вышел зайчик погулять, вдруг охотник выбега.',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает прямо в зай.',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает прямо в зайчика стре.',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает прямо в зайчика стреля.',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. и в',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. и впал в Уми',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. И впал в умира.',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. и впал в умирают за',
        'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. И впал в умирают, зайчик мой.',
      ];

      let accumulated = '';
      for (const chunk of chunks) {
        accumulated = StreamReconciler.reconcileText(accumulated, chunk);
      }

      expect(accumulated).toBe(
        'а Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает, прямо в зайчика стреляет. И впал в умирают, зайчик мой.'
      );
    });

    it('appends disjoint speech gracefully', () => {
      const cur = 'First point.';
      const inc = 'Second point.';
      expect(StreamReconciler.reconcileText(cur, inc)).toBe('First point. Second point.');
    });
  });

  describe('Turn tracking and lifecycle', () => {
    it('groups continuous speech from the same speaker', () => {
      const reconciler = new StreamReconciler({ turnSilenceThresholdMs: 2000 });
      const now = 1000;

      reconciler.ingest({
        speaker: 'Alice',
        text: 'Good morning',
        timestamp: now,
      });

      reconciler.ingest({
        speaker: 'Alice',
        text: 'Good morning everyone',
        timestamp: now + 500,
      });

      const active = reconciler.getActiveSegment();
      expect(active).not.toBeNull();
      expect(active?.speaker).toBe('Alice');
      expect(active?.text).toBe('Good morning everyone');
      expect(reconciler.getFinalizedSegments().length).toBe(0);
    });

    it('finalizes previous turn when speaker changes', () => {
      const reconciler = new StreamReconciler({ turnSilenceThresholdMs: 2000 });
      const finalized: import('../src/core/types').TranscriptSegment[] = [];
      reconciler.onSegmentFinalized((seg) => finalized.push(seg));

      reconciler.ingest({
        speaker: 'Alice',
        text: 'Hello from Alice',
        timestamp: 1000,
      });

      // Speaker switches to Bob
      reconciler.ingest({
        speaker: 'Bob',
        text: 'Hi Alice, Bob here',
        timestamp: 1500,
      });

      expect(finalized.length).toBe(1);
      expect(finalized[0].speaker).toBe('Alice');
      expect(finalized[0].text).toBe('Hello from Alice');

      const active = reconciler.getActiveSegment();
      expect(active?.speaker).toBe('Bob');
      expect(active?.text).toBe('Hi Alice, Bob here');
    });

    it('finalizes active turn after silence threshold timeout', () => {
      const reconciler = new StreamReconciler({ turnSilenceThresholdMs: 2000 });
      const finalized: import('../src/core/types').TranscriptSegment[] = [];
      reconciler.onSegmentFinalized((seg) => finalized.push(seg));

      reconciler.ingest({
        speaker: 'Charlie',
        text: 'Let me think about that.',
        timestamp: 1000,
      });

      expect(finalized.length).toBe(0);

      // Advance time beyond silence threshold
      vi.advanceTimersByTime(2500);

      expect(finalized.length).toBe(1);
      expect(finalized[0].speaker).toBe('Charlie');
      expect(finalized[0].text).toBe('Let me think about that.');
      expect(reconciler.getActiveSegment()).toBeNull();
    });

    it('strips lingering finalized captions when speaker continues speaking in subsequent turns', () => {
      const reconciler = new StreamReconciler({ turnSilenceThresholdMs: 2000 });
      const finalized: import('../src/core/types').TranscriptSegment[] = [];
      reconciler.onSegmentFinalized((seg) => finalized.push(seg));

      // Turn 1
      reconciler.ingest({
        speaker: 'You',
        text: 'раз два три 4 5 вышел погулять. Друг охотник выбегает. Прямо в зайчика стреляет. пиф-паф ой Умирает зайчик мой.',
        timestamp: 1000,
      });

      // Turn 1 times out
      vi.advanceTimersByTime(2500);
      expect(finalized.length).toBe(1);
      expect(finalized[0].text).toBe(
        'раз два три 4 5 вышел погулять. Друг охотник выбегает. Прямо в зайчика стреляет. пиф-паф ой Умирает зайчик мой.'
      );

      // Turn 2 arrives with persistent Google Meet DOM containing Turn 1 + Turn 2
      reconciler.ingest({
        speaker: 'You',
        text: 'раз два три 4 5 вышел погулять. Друг охотник выбегает. Прямо в зайчика стреляет. пиф-паф ой Умирает зайчик мой. Привезли его в больницу. Он сошел там рукавицу. Привезли его домой оказался, он живой.',
        timestamp: 4000,
      });

      // Turn 2 times out
      vi.advanceTimersByTime(2500);
      expect(finalized.length).toBe(2);
      expect(finalized[1].text).toBe(
        'Привезли его в больницу. Он сошел там рукавицу. Привезли его домой оказался, он живой.'
      );
    });

    it('handles middle-of-sentence word revisions across finalized turns using tail anchors', () => {
      const reconciler = new StreamReconciler({ turnSilenceThresholdMs: 2000 });
      const finalized: import('../src/core/types').TranscriptSegment[] = [];
      reconciler.onSegmentFinalized((seg) => finalized.push(seg));

      // Turn 1 finalized with "прямо"
      reconciler.ingest({
        speaker: 'You',
        text: 'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает. прямо',
        timestamp: 1000,
      });
      vi.advanceTimersByTime(2500);

      // Turn 2 finalized with "в зайчика стреляет пиф-паф, а я"
      reconciler.ingest({
        speaker: 'You',
        text: 'в зайчика стреляет пиф-паф, а я',
        timestamp: 4000,
      });
      vi.advanceTimersByTime(2500);

      expect(finalized.length).toBe(2);

      // Turn 3 arrives: Google Meet retained the whole stanza, deleted "прямо", and added "Умирает зайчик мой."
      reconciler.ingest({
        speaker: 'You',
        text: 'Раз два три четыре пять Вышел зайчик погулять. Вдруг охотник выбегает. в зайчика стреляет пиф-паф, а я Умирает зайчик мой.',
        timestamp: 8000,
      });
      vi.advanceTimersByTime(2500);

      expect(finalized.length).toBe(3);
      expect(finalized[2].text).toBe('Умирает зайчик мой.');
    });
  });
});
