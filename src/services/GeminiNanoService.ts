import type { AIModelStatus, AISummaryResult, TranscriptSegment } from '../core/types';

export interface AISession {
  prompt(text: string): Promise<string>;
  promptStreaming?(text: string): AsyncIterable<string>;
  destroy?(): void;
}

export interface AILanguageModel {
  capabilities?: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  availability?: () => Promise<'readily' | 'after-download' | 'no'>;
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
        avail = await lm.availability();
      } else if (typeof lm.capabilities === 'function') {
        const caps = await lm.capabilities();
        avail = caps.available;
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

  /**
   * Generate meeting summary and action items using Chrome's built-in Gemini Nano.
   * Employs smart hierarchical chunking if transcript is long.
   */
  public static async summarizeMeeting(
    segments: TranscriptSegment[],
    onProgress?: (partialText: string) => void
  ): Promise<AISummaryResult> {
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
    let finalSummary = '';

    if (wordCount > 1800) {
      // Long meeting: Hierarchical summarization
      onProgress?.('Analyzing long meeting in sections...\n');
      finalSummary = await this.hierarchicalSummarize(segments, lm, onProgress);
    } else {
      // Standard meeting: Single-pass summarization
      finalSummary = await this.singlePassSummarize(fullTranscript, lm, onProgress);
    }

    return this.parseSummaryResult(finalSummary);
  }

  private static async createSession(lm?: AILanguageModel): Promise<AISession> {
    const systemPrompt =
      'You are an executive meeting assistant. Provide a concise executive summary, key discussion points, and clear action items with assignees if mentioned. Do not make up facts.';

    if (lm?.create) {
      return await lm.create({
        systemPrompt,
        temperature: 0.2,
        topK: 3,
      });
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
    onProgress?: (partialText: string) => void
  ): Promise<string> {
    const session = await this.createSession(lm);

    try {
      const prompt = `Please summarize this meeting transcript:
Format your response with the following markdown headers:
### Executive Summary
### Key Discussion Points
### Action Items & Decisions

Transcript:
${transcript}`;

      if (session.promptStreaming) {
        let accumulated = '';
        const stream = session.promptStreaming(prompt);
        for await (const chunk of stream) {
          accumulated = chunk;
          onProgress?.(accumulated);
        }
        return accumulated;
      } else {
        const result = await session.prompt(prompt);
        onProgress?.(result);
        return result;
      }
    } finally {
      if (session.destroy) {
        session.destroy();
      }
    }
  }

  private static async hierarchicalSummarize(
    segments: TranscriptSegment[],
    lm?: AILanguageModel,
    onProgress?: (partialText: string) => void
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

    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(`Processing section ${i + 1} of ${chunks.length}...\n`);
      const session = await this.createSession(lm);
      try {
        const prompt = `Provide 3-5 concise bullet points of the main discussions and any tasks in this meeting section:\n\n${chunks[i]}`;
        const partial = await session.prompt(prompt);
        chunkSummaries.push(partial);
      } finally {
        if (session.destroy) session.destroy();
      }
    }

    // Synthesize combined chunk summaries
    onProgress?.('Synthesizing final executive summary and action items...\n');
    const synthesisSession = await this.createSession(lm);
    try {
      const combinedPrompt = `Synthesize these section notes into a cohesive final meeting summary:
Format with markdown headers:
### Executive Summary
### Key Discussion Points
### Action Items & Decisions

Section notes:
${chunkSummaries.join('\n\n')}`;

      if (synthesisSession.promptStreaming) {
        let accumulated = '';
        const stream = synthesisSession.promptStreaming(combinedPrompt);
        for await (const chunk of stream) {
          accumulated = chunk;
          onProgress?.(accumulated);
        }
        return accumulated;
      } else {
        const finalOutput = await synthesisSession.prompt(combinedPrompt);
        onProgress?.(finalOutput);
        return finalOutput;
      }
    } finally {
      if (synthesisSession.destroy) synthesisSession.destroy();
    }
  }

  private static parseSummaryResult(raw: string): AISummaryResult {
    const keyPoints: string[] = [];
    const actionItems: string[] = [];
    const decisions: string[] = [];

    const lines = raw.split('\n');
    let currentSection = 'summary';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const lower = trimmed.toLowerCase();
      if (lower.includes('key discussion') || lower.includes('key points')) {
        currentSection = 'points';
        continue;
      } else if (lower.includes('action items') || lower.includes('next steps')) {
        currentSection = 'actions';
        continue;
      } else if (lower.includes('decision')) {
        currentSection = 'decisions';
        continue;
      }

      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        const cleanBullet = trimmed.replace(/^[-*]|\d+\.\s*/, '').trim();
        if (currentSection === 'points') keyPoints.push(cleanBullet);
        else if (currentSection === 'actions') actionItems.push(cleanBullet);
        else if (currentSection === 'decisions') decisions.push(cleanBullet);
      }
    }

    return {
      summary: raw,
      keyPoints,
      actionItems,
      decisions,
      rawOutput: raw,
    };
  }
}
