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
   * Safe fallback language codes if the browser does not support Prompt API language inspection.
   */
  public static readonly FALLBACK_SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr', 'ja'];

  /**
   * Cached dynamically detected Prompt API supported language codes.
   */
  private static cachedSupportedLanguages: string[] | null = null;
  private static detectPromise: Promise<string[]> | null = null;

  /**
   * Clear cached languages (useful for testing).
   */
  public static clearSupportedLanguagesCache(): void {
    this.cachedSupportedLanguages = null;
    this.detectPromise = null;
  }

  /**
   * Dynamically detect which languages are supported by Chrome's LanguageModel Prompt API.
   * Memoized: executes probe once and caches the result for the entire session.
   * 1. Checks if capabilities() exposes supported languages directly (future W3C spec).
   * 2. Probes LanguageModel.availability() with a dummy tag to extract Chrome's dynamic whitelist from the error.
   * 3. Tests candidate languages via availability().
   * 4. Defaults to safe fallback list ['de', 'en', 'es', 'fr', 'ja'].
   */
  public static async detectSupportedLanguages(lm?: AILanguageModel): Promise<string[]> {
    if (this.cachedSupportedLanguages && this.cachedSupportedLanguages.length > 0) {
      return this.cachedSupportedLanguages;
    }
    if (this.detectPromise) {
      return this.detectPromise;
    }

    this.detectPromise = (async () => {
      const ai =
        lm ||
        (typeof window !== 'undefined'
          ? window.ai?.languageModel || (window.LanguageModel as AILanguageModel | undefined)
          : undefined);

      if (!ai) {
        this.cachedSupportedLanguages = this.FALLBACK_SUPPORTED_LANGUAGES;
        return this.FALLBACK_SUPPORTED_LANGUAGES;
      }

      // 1. Check if capabilities() or params() exposes supported languages directly
      if (typeof ai.capabilities === 'function') {
        try {
          const caps = (await ai.capabilities()) as Record<string, unknown>;
          const list = (caps?.languages || caps?.supportedLanguages) as string[] | undefined;
          if (Array.isArray(list) && list.length > 0) {
            const lower = list.map((l) => l.toLowerCase());
            this.cachedSupportedLanguages = lower;
            return lower;
          }
        } catch {
          // ignore
        }
      }

      // 2. Probe availability() with an invalid tag to extract Chrome's dynamic whitelist from the error message
      if (typeof ai.availability === 'function') {
        try {
          await ai.availability({
            expectedOutputs: [{ type: 'text', languages: ['__probe__'] }],
          });
        } catch (err: unknown) {
          const message = String((err as Error)?.message || err);
          const match = message.match(/supported language codes:\s*\[([^\]]+)\]/i);
          if (match && match[1]) {
            const parsed = match[1]
              .split(',')
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
            if (parsed.length > 0) {
              this.cachedSupportedLanguages = parsed;
              return parsed;
            }
          }
        }
      }

      // 3. Alternatively probe candidate languages individually via availability()
      if (typeof ai.availability === 'function') {
        const candidates = Object.keys(this.SUPPORTED_LANGUAGES);
        const verified: string[] = [];
        for (const lang of candidates) {
          try {
            const status = await ai.availability({
              expectedOutputs: [{ type: 'text', languages: [lang] }],
            });
            const s = String(status);
            if (
              s === 'readily' ||
              s === 'available' ||
              s === 'after-download' ||
              s === 'downloadable' ||
              s === 'downloading'
            ) {
              verified.push(lang);
            }
          } catch {
            // Unsupported language rejected
          }
        }
        if (verified.length > 0) {
          this.cachedSupportedLanguages = verified;
          return verified;
        }
      }

      this.cachedSupportedLanguages = this.FALLBACK_SUPPORTED_LANGUAGES;
      return this.FALLBACK_SUPPORTED_LANGUAGES;
    })();

    return this.detectPromise;
  }

  /**
   * Return a supported output language code for Chrome's Prompt API.
   * If targetLanguage is in the supported list, it is returned.
   * Otherwise, falls back to the user's browser language (if supported), or 'en'.
   */
  public static getSupportedOutputLanguage(
    targetLanguage?: string,
    supportedList: string[] = this.cachedSupportedLanguages || this.FALLBACK_SUPPORTED_LANGUAGES
  ): string {
    if (targetLanguage && supportedList.includes(targetLanguage.toLowerCase())) {
      return targetLanguage.toLowerCase();
    }
    const navLang = (typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en')
      .slice(0, 2)
      .toLowerCase();
    return supportedList.includes(navLang) ? navLang : supportedList[0] || 'en';
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

      if (typeof lm.availability === 'function') {
        try {
          const res = await lm.availability();
          const s = String(res);
          if (s === 'readily' || s === 'available') {
            avail = 'readily';
          } else if (s === 'after-download' || s === 'downloadable' || s === 'downloading') {
            avail = 'after-download';
          }
        } catch {
          if (typeof lm.create === 'function') {
            avail = 'readily';
          }
        }
      } else if (typeof lm.capabilities === 'function') {
        try {
          const caps = await lm.capabilities();
          if (caps.available === 'readily' || caps.available === 'after-download') {
            avail = caps.available;
          }
        } catch {
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

    // Detect supported Prompt API languages once for this entire summarization run
    const supportedLangs = await this.detectSupportedLanguages(lm);

    if (wordCount > 1800) {
      // Long meeting: Hierarchical summarization
      onProgress?.('Analyzing long meeting in sections...\n');
      return this.hierarchicalSummarize(segments, lm, onProgress, targetLanguage, supportedLangs);
    } else {
      // Standard meeting: Single-pass summarization
      return this.singlePassSummarize(
        fullTranscript,
        lm,
        onProgress,
        targetLanguage,
        supportedLangs
      );
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
    targetLanguage?: string,
    supportedLangs?: string[]
  ): Promise<AISession> {
    const langInstruction = this.getLanguageInstruction(targetLanguage);
    const systemPrompt = `You are an executive meeting assistant. Provide a concise executive summary, key discussion points, and clear action items with assignees if mentioned. Do not make up facts. ${langInstruction}`;
    const langs = supportedLangs || (await this.detectSupportedLanguages(lm));
    const outputLang = this.getSupportedOutputLanguage(targetLanguage, langs);

    if (lm?.create) {
      // Fallbacks ordered by Chrome API revision (Chrome 131+ down to early builds)
      // Note: expectedOutputs must only declare Chrome-supported language codes [de, en, es, fr, ja]
      const candidates: Record<string, unknown>[] = [
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
          expectedInputs: [{ type: 'text', languages: [outputLang] }],
          expectedOutputs: [{ type: 'text', languages: [outputLang] }],
        },
        {
          initialPrompts: [{ role: 'system', content: systemPrompt }],
          temperature: 0.2,
          topK: 3,
          expectedOutputs: [{ type: 'text', languages: [outputLang] }],
        },
        {
          systemPrompt,
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
    targetLanguage?: string,
    supportedLangs?: string[]
  ): Promise<string> {
    const session = await this.createSession(lm, targetLanguage, supportedLangs);
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
    targetLanguage?: string,
    supportedLangs?: string[]
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
      const session = await this.createSession(lm, targetLanguage, supportedLangs);
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
    const synthesisSession = await this.createSession(lm, targetLanguage, supportedLangs);
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
