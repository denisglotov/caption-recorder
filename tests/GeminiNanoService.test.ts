import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiNanoService } from '../src/services/GeminiNanoService';
import type { TranscriptSegment } from '../src/core/types';

describe('GeminiNanoService', () => {
  describe('collectStream', () => {
    it('accumulates delta token chunks correctly and does not wipe on trailing empty chunk', async () => {
      async function* mockDeltaStream() {
        yield '### Executive';
        yield ' Summary\n';
        yield 'The meeting ';
        yield 'concluded successfully.';
        yield ''; // EOF empty chunk
      }

      const progressSteps: string[] = [];
      const result = await GeminiNanoService.collectStream(mockDeltaStream(), (text) => {
        progressSteps.push(text);
      });

      expect(result).toBe('### Executive Summary\nThe meeting concluded successfully.');
      expect(progressSteps).toEqual([
        '### Executive',
        '### Executive Summary\n',
        '### Executive Summary\nThe meeting ',
        '### Executive Summary\nThe meeting concluded successfully.',
      ]);
    });

    it('handles cumulative snapshot streams gracefully', async () => {
      async function* mockCumulativeStream() {
        yield '###';
        yield '### Executive';
        yield '### Executive Summary\n';
        yield '### Executive Summary\nAll actions assigned.';
        yield '';
      }

      const progressSteps: string[] = [];
      const result = await GeminiNanoService.collectStream(mockCumulativeStream(), (text) => {
        progressSteps.push(text);
      });

      expect(result).toBe('### Executive Summary\nAll actions assigned.');
      expect(progressSteps).toEqual([
        '###',
        '### Executive',
        '### Executive Summary\n',
        '### Executive Summary\nAll actions assigned.',
      ]);
    });

    it('handles streams using getReader() interface', async () => {
      const chunks = ['First part, ', 'second part.'];
      let idx = 0;
      const releaseLock = vi.fn();

      const mockStream = {
        getReader() {
          return {
            async read() {
              if (idx < chunks.length) {
                return { done: false, value: chunks[idx++] };
              }
              return { done: true, value: undefined };
            },
            releaseLock,
          };
        },
      };

      const result = await GeminiNanoService.collectStream(mockStream);
      expect(result).toBe('First part, second part.');
      expect(releaseLock).toHaveBeenCalled();
    });
  });

  describe('summarizeMeeting with streaming', () => {
    const mockSegments: TranscriptSegment[] = [
      {
        id: '1',
        speaker: 'Alice',
        text: 'Let us discuss the release timeline.',
        startTime: 1000,
        endTime: 3000,
      },
      {
        id: '2',
        speaker: 'Bob',
        text: 'The release will go out next Tuesday.',
        startTime: 4000,
        endTime: 6000,
      },
    ];

    let originalWindow: unknown;

    beforeEach(() => {
      originalWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = {
        ai: undefined,
        LanguageModel: undefined,
      };
    });

    afterEach(() => {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
      } else {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
      vi.restoreAllMocks();
    });

    it('accumulates delta streaming chunks and parses structured sections', async () => {
      async function* mockStream() {
        yield '### Executive Summary\n';
        yield 'The team agreed on next Tuesday.\n';
        yield '### Key Discussion Points\n';
        yield '- Release timeline confirmed\n';
        yield '### Action Items & Decisions\n';
        yield '- Bob to prepare build\n';
        yield '';
      }

      const destroyMock = vi.fn();
      const mockSession = {
        promptStreaming: vi.fn(() => mockStream()),
        prompt: vi.fn(),
        destroy: destroyMock,
      };

      (window as unknown as { LanguageModel?: unknown }).LanguageModel = {
        create: vi.fn().mockResolvedValue(mockSession),
      };

      const progressUpdates: string[] = [];
      const result = await GeminiNanoService.summarizeMeeting(mockSegments, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result).toContain('The team agreed on next Tuesday.');
      expect(result).toContain('Release timeline confirmed');
      expect(result).toContain('Bob to prepare build');
      expect(destroyMock).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toContain('Bob to prepare build');
    });

    it('falls back to session.prompt if streaming yields empty string', async () => {
      async function* emptyStream() {
        yield '';
      }

      const fallbackText =
        '### Executive Summary\nFallback summary.\n### Key Discussion Points\n- Key point';

      const mockSession = {
        promptStreaming: vi.fn(() => emptyStream()),
        prompt: vi.fn().mockResolvedValue(fallbackText),
        destroy: vi.fn(),
      };

      (window as unknown as { LanguageModel?: unknown }).LanguageModel = {
        create: vi.fn().mockResolvedValue(mockSession),
      };

      const result = await GeminiNanoService.summarizeMeeting(mockSegments);
      expect(mockSession.prompt).toHaveBeenCalled();
      expect(result).toBe(fallbackText);
    });

    it('works when session only supports non-streaming prompt', async () => {
      const summaryText =
        '### Executive Summary\nStandard prompt output.\n### Action Items & Decisions\n- Ship v1.0';

      const mockSession = {
        prompt: vi.fn().mockResolvedValue(summaryText),
        destroy: vi.fn(),
      };

      (window as unknown as { LanguageModel?: unknown }).LanguageModel = {
        create: vi.fn().mockResolvedValue(mockSession),
      };

      const result = await GeminiNanoService.summarizeMeeting(mockSegments);
      expect(mockSession.prompt).toHaveBeenCalled();
      expect(result).toBe(summaryText);
    });

    it('injects target language instruction into the prompt', async () => {
      let capturedPrompt = '';
      const russianSummary = `### Краткое резюме
Команда обсудила релиз.
### Ключевые моменты
- Дата релиза перенесена на вторник
### Задачи
- Денис подготовит сборку расширения
### Решения
- Утвердить план релиза`;

      const mockSession = {
        promptStreaming: vi.fn((promptText: string) => {
          capturedPrompt = promptText;
          async function* stream() {
            yield russianSummary;
          }
          return stream();
        }),
        prompt: vi.fn(),
        destroy: vi.fn(),
      };

      (window as unknown as { LanguageModel?: unknown }).LanguageModel = {
        create: vi.fn().mockResolvedValue(mockSession),
      };

      const result = await GeminiNanoService.summarizeMeeting(mockSegments, undefined, 'ru');

      expect(capturedPrompt).toContain('Russian');
      expect(result).toBe(russianSummary);
    });

    it('generates appropriate language instructions via getLanguageInstruction', () => {
      expect(GeminiNanoService.getLanguageInstruction('auto')).toContain(
        'primary language of the transcript'
      );
      expect(GeminiNanoService.getLanguageInstruction('de')).toContain('German');
      expect(GeminiNanoService.getLanguageInstruction('fr')).toContain('French');
      expect(GeminiNanoService.getLanguageInstruction('ja')).toContain('Japanese');
      expect(GeminiNanoService.getLanguageInstruction('ru')).toContain('Russian');
    });
  });
});
