import type { AIModelStatus, TranscriptSegment } from '../core/types';

export interface AISession {
  prompt(text: string): Promise<string>;
  promptStreaming?(text: string): AsyncIterable<string>;
  destroy?(): void;
}

export interface AILanguageModel {
  capabilities?: (
    options?: Record<string, unknown>
  ) => Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  availability?: (
    options?: Record<string, unknown>
  ) => Promise<'readily' | 'after-download' | 'no'>;
  create?: (options?: Record<string, unknown>) => Promise<AISession>;
  params?: () => Promise<Record<string, unknown>>;
}

export interface ChromeAI {
  languageModel?: AILanguageModel;
  createTextSession?: (options?: Record<string, unknown>) => Promise<AISession>;
}

declare global {
  interface Window {
    ai?: ChromeAI;
    LanguageModel?: AILanguageModel;
  }
}

export class GeminiNanoService {
  /**
   * Return a supported output language code for Chrome's Prompt API (de, en, es, fr, ja).
   */
  public static getSupportedOutputLanguage(): string {
    const navLang = (typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en')
      .slice(0, 2)
      .toLowerCase();
    const supported = ['de', 'en', 'es', 'fr', 'ja'];
    return supported.includes(navLang) ? navLang : 'en';
  }

  /**
   * Check if Gemini Nano is available on this browser.
   */
  public static async checkAvailability(): Promise<AIModelStatus> {
    const ai = typeof window !== 'undefined' ? window.ai || window.LanguageModel : undefined;

    if (!ai) {
      return {
        available: false,
        status: 'unsupported-browser',
        message: 'Chrome Built-in AI (Gemini Nano) is not detected in this browser.',
      };
    }

    try {
      const lm: AILanguageModel | undefined =
        'languageModel' in ai && ai.languageModel ? ai.languageModel : (ai as AILanguageModel);

      let avail: 'readily' | 'after-download' | 'no' = 'no';
      const outputLang = this.getSupportedOutputLanguage();
      const checkOpts = {
        expectedInputs: [{ type: 'text', languages: [outputLang] }],
        expectedOutputs: [{ type: 'text', languages: [outputLang] }],
      };

      if (typeof lm.availability === 'function') {
        try {
          const res = await lm.availability(checkOpts);
          if (res === 'readily' || (res as string) === 'available') {
            avail = 'readily';
          } else if (
            res === 'after-download' ||
            (res as string) === 'downloadable' ||
            (res as string) === 'downloading'
          ) {
            avail = 'after-download';
          }
        } catch {
          // If availability with options failed, fallback to checking if create is supported
          if (typeof lm.create === 'function') {
            avail = 'readily';
          }
        }
      } else if (typeof lm.create === 'function') {
        avail = 'readily';
      }

      if (avail === 'readily') {
        return { available: true, status: 'readily' };
      } else if (avail === 'after-download') {
        return {
          available: false,
          status: 'after-download',
          message: 'Gemini Nano model is downloading on this device.',
        };
      } else {
        return {
          available: false,
          status: 'no',
          message:
            'Gemini Nano is not available. Check chrome://flags/#optimization-guide-on-device-model',
        };
      }
    } catch (err) {
      return {
        available: false,
        status: 'no',
        message: `Error probing Gemini Nano: ${String(err)}`,
      };
    }
  }

  public static readonly SUPPORTED_LANGUAGES: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    de: 'German',
    fr: 'French',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    pt: 'Portuguese',
    it: 'Italian',
  };

  /**
   * Return a prompt instruction specifying the desired summary language.
   */
  public static getLanguageInstruction(targetLanguage?: string): string {
    if (!targetLanguage || targetLanguage === 'auto') {
      return 'Write the executive summary, key points, and action items in the primary language of the transcript.';
    }
    const langName = this.SUPPORTED_LANGUAGES[targetLanguage.toLowerCase()] || targetLanguage;
    return `Write the entire executive summary, key discussion points, and action items in ${langName}.`;
  }

  /**
   * Generate meeting summary and action items using Chrome's built-in Gemini Nano.
   * Employs smart hierarchical chunking if transcript is long.
   */
  public static async summarizeMeeting(
    segments: TranscriptSegment[],
    onProgress?: (partialText: string) => void,
    targetLanguage?: string
  ): Promise<string> {
    if (segments.length === 0) {
      throw new Error('No transcript segments to summarize.');
    }

    const ai = typeof window !== 'undefined' ? window.ai || window.LanguageModel : undefined;
    const lm: AILanguageModel | undefined =
      ai && 'languageModel' in ai && ai.languageModel
        ? ai.languageModel
        : (ai as AILanguageModel | undefined);

    if (!lm?.create && !window.ai?.createTextSession) {
      throw new Error(
        'Gemini Nano language model session creation is not supported in this browser.'
      );
    }

    // Format full transcript into clean text
    const fullTranscript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');

    const wordCount = fullTranscript.split(/\s+/).length;

    if (wordCount > 1800) {
      // Long meeting: Hierarchical summarization
      onProgress?.('Analyzing long meeting in sections...\n');
      return this.hierarchicalSummarize(segments, lm, onProgress, targetLanguage);
    } else {
      // Standard meeting: Single-pass summarization
      return this.singlePassSummarize(fullTranscript, lm, onProgress, targetLanguage);
    }
  }

  /**
   * Collect streaming output from either delta chunks (standard Chrome Prompt API)
   * or cumulative snapshots, guarding against empty terminator chunks.
   */
  public static async collectStream(
    stream: unknown,
    onProgress?: (accumulated: string) => void
  ): Promise<string> {
    if (!stream || typeof stream !== 'object') return '';

    let iterator: AsyncIterable<string>;
    if (Symbol.asyncIterator in stream) {
      iterator = stream as AsyncIterable<string>;
    } else if ('getReader' in stream) {
      const reader = (stream as ReadableStream<string>).getReader();
      iterator = {
        async *[Symbol.asyncIterator]() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) yield value;
            }
          } finally {
            reader.releaseLock();
          }
        },
      };
    } else {
      return '';
    }

    let accumulated = '';
    let isCumulative: boolean | null = null;

    for await (const chunk of iterator) {
      if (!chunk) continue;
      if (isCumulative === null && accumulated.length > 0) {
        isCumulative = chunk.startsWith(accumulated);
      }
      accumulated = isCumulative ? chunk : accumulated + chunk;
      onProgress?.(accumulated);
    }

    return accumulated;
  }

  /**
   * Run a prompt on an AI session with streaming and non-streaming fallback.
   */
  private static async runPrompt(
    session: AISession,
    prompt: string,
    onProgress?: (partialText: string) => void
  ): Promise<string> {
    if (session.promptStreaming) {
      let accumulated = '';
      try {
        const stream = session.promptStreaming(prompt);
        accumulated = await this.collectStream(stream, onProgress);
      } catch (streamErr) {
        console.warn('[GeminiNanoService] Streaming failed, falling back to prompt()', streamErr);
      }

      if (!accumulated.trim()) {
        accumulated = await session.prompt(prompt);
        onProgress?.(accumulated);
      }
      return accumulated;
    }

    const result = await session.prompt(prompt);
    onProgress?.(result);
    return result;
  }

  /**
   * Creates an AI session, trying candidate options in order of modernity
   * to maintain compatibility across evolving Chrome Prompt API versions.
   */
  private static async createSession(
    lm?: AILanguageModel,
    targetLanguage?: string
  ): Promise<AISession> {
    const langInstruction = this.getLanguageInstruction(targetLanguage);
    const systemPrompt = `You are an executive meeting assistant. Provide a concise executive summary, key discussion points, and clear action items with assignees if mentioned. Do not make up facts. ${langInstruction}`;
    const outputLang =
      targetLanguage && targetLanguage !== 'auto' && targetLanguage in this.SUPPORTED_LANGUAGES
        ? targetLanguage
        : this.getSupportedOutputLanguage();

    if (lm?.create) {
      // Fallbacks ordered by Chrome API revision (Chrome 131+ down to early builds)
      const candidates: Record<string, unknown>[] = [
        {
          systemPrompt,
          temperature: 0.2,
          topK: 3,
          expectedInputs: [{ type: 'text', languages: [outputLang] }],
          expectedOutputs: [{ type: 'text', languages: [outputLang] }],
        },
        {
          systemPrompt,
          temperature: 0.2,
          topK: 3,
          expectedOutputs: [{ type: 'text', languages: [outputLang] }],
        },
        {
          systemPrompt,
          temperature: 0.2,
          topK: 3,
        },
        {
          initialPrompts: [{ role: 'system', content: systemPrompt }],
          temperature: 0.2,
          topK: 3,
        },
        {},
      ];

      for (const config of candidates) {
        try {
          return await lm.create(config);
        } catch {
          // Try next candidate if unsupported
        }
      }
    }

    if (window.ai?.createTextSession) {
      return await window.ai.createTextSession({
        systemPrompt,
      });
    }

    throw new Error('No compatible AI session creator found.');
  }

  private static async singlePassSummarize(
    transcript: string,
    lm?: AILanguageModel,
    onProgress?: (partialText: string) => void,
    targetLanguage?: string
  ): Promise<string> {
    const session = await this.createSession(lm, targetLanguage);
    const langInstruction = this.getLanguageInstruction(targetLanguage);

    try {
      const prompt = `Please summarize this meeting transcript:
${langInstruction}
Format your response with the following markdown headers (or their translation in the target language):
### Executive Summary
### Key Discussion Points
### Action Items & Decisions

Transcript:
${transcript}`;

      return await this.runPrompt(session, prompt, onProgress);
    } finally {
      if (session.destroy) {
        session.destroy();
      }
    }
  }

  private static async hierarchicalSummarize(
    segments: TranscriptSegment[],
    lm?: AILanguageModel,
    onProgress?: (partialText: string) => void,
    targetLanguage?: string
  ): Promise<string> {
    // Break segments into chunks of ~1200 words
    const chunks: string[] = [];
    let currentChunkWords = 0;
    let currentChunkLines: string[] = [];

    for (const seg of segments) {
      const line = `${seg.speaker}: ${seg.text}`;
      const words = seg.text.split(/\s+/).length;

      if (currentChunkWords + words > 1200 && currentChunkLines.length > 0) {
        chunks.push(currentChunkLines.join('\n'));
        currentChunkLines = [line];
        currentChunkWords = words;
      } else {
        currentChunkLines.push(line);
        currentChunkWords += words;
      }
    }

    if (currentChunkLines.length > 0) {
      chunks.push(currentChunkLines.join('\n'));
    }

    const langInstruction = this.getLanguageInstruction(targetLanguage);
    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(`Processing section ${i + 1} of ${chunks.length}...\n`);
      const session = await this.createSession(lm, targetLanguage);
      try {
        const prompt = `Provide 3-5 concise bullet points of the main discussions and any tasks in this meeting section (${langInstruction}):\n\n${chunks[i]}`;
        const partial = await session.prompt(prompt);
        chunkSummaries.push(partial);
      } finally {
        if (session.destroy) session.destroy();
      }
    }

    // Synthesize combined chunk summaries
    onProgress?.('Synthesizing final executive summary and action items...\n');
    const synthesisSession = await this.createSession(lm, targetLanguage);
    try {
      const combinedPrompt = `Synthesize these section notes into a cohesive final meeting summary:
${langInstruction}
Format with markdown headers:
### Executive Summary
### Key Discussion Points
### Action Items & Decisions

Section notes:
${chunkSummaries.join('\n\n')}`;

      return await this.runPrompt(synthesisSession, combinedPrompt, onProgress);
    } finally {
      if (synthesisSession.destroy) synthesisSession.destroy();
    }
  }
}
