import type { InterimCaption, TranscriptSegment } from './types';

export interface StreamReconcilerOptions {
  /** Maximum silence duration before a speaker turn is automatically finalized (ms) */
  turnSilenceThresholdMs?: number;
}

export type SegmentFinalizedCallback = (segment: TranscriptSegment) => void;
export type ActiveTurnUpdateCallback = (activeSegment: TranscriptSegment | null) => void;

/**
 * Normalizes a word for speech comparison: lowercases and strips punctuation,
 * while preserving Unicode letters and numbers across all alphabets.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export class StreamReconciler {
  private turnSilenceThresholdMs: number;
  private activeSegment: TranscriptSegment | null = null;
  private finalizedSegments: TranscriptSegment[] = [];
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  private onFinalizedCallbacks: Set<SegmentFinalizedCallback> = new Set();
  private onActiveUpdateCallbacks: Set<ActiveTurnUpdateCallback> = new Set();

  constructor(options: StreamReconcilerOptions = {}) {
    this.turnSilenceThresholdMs = options.turnSilenceThresholdMs ?? 7000;
  }

  public onSegmentFinalized(cb: SegmentFinalizedCallback): () => void {
    this.onFinalizedCallbacks.add(cb);
    return () => this.onFinalizedCallbacks.delete(cb);
  }

  public onActiveTurnUpdate(cb: ActiveTurnUpdateCallback): () => void {
    this.onActiveUpdateCallbacks.add(cb);
    return () => this.onActiveUpdateCallbacks.delete(cb);
  }

  /**
   * Process a live interim caption chunk from a platform adapter.
   */
  public ingest(caption: InterimCaption): void {
    const rawText = caption.text.trim();
    if (!rawText) return;

    const now = caption.timestamp || Date.now();
    const cleanSpeaker = caption.speaker.trim() || 'Unknown Speaker';

    // Strip text from previously finalized turns of the same speaker
    const cleanText = this.stripAlreadyFinalized(rawText, cleanSpeaker);
    if (!cleanText) return;

    // If speaker changed, finalize the previous turn immediately
    if (this.activeSegment && this.activeSegment.speaker !== cleanSpeaker) {
      this.finalizeActiveTurn();
    }

    // Reset silence timer
    this.resetSilenceTimer();

    if (!this.activeSegment) {
      // Start a new speaker turn
      this.activeSegment = {
        id: `seg_${now}_${Math.random().toString(36).slice(2, 8)}`,
        speaker: cleanSpeaker,
        startTime: now,
        endTime: now,
        text: cleanText,
      };
    } else {
      // Reconcile new text with current active segment text
      const merged = StreamReconciler.reconcileText(this.activeSegment.text, cleanText);
      this.activeSegment.text = merged;
      this.activeSegment.endTime = now;
    }

    this.notifyActiveUpdate();
  }

  /**
   * Finalize current active turn if one exists.
   */
  public finalizeActiveTurn(): void {
    this.clearSilenceTimer();

    if (!this.activeSegment) return;

    const trimmedText = this.activeSegment.text.trim();
    if (trimmedText.length > 0) {
      const segment: TranscriptSegment = {
        ...this.activeSegment,
        text: trimmedText,
      };
      this.finalizedSegments.push(segment);
      this.notifyFinalized(segment);
    }

    this.activeSegment = null;
    this.notifyActiveUpdate();
  }

  public getAllSegments(): TranscriptSegment[] {
    if (this.activeSegment && this.activeSegment.text.trim()) {
      return [...this.finalizedSegments, { ...this.activeSegment }];
    }
    return [...this.finalizedSegments];
  }

  public getFinalizedSegments(): TranscriptSegment[] {
    return [...this.finalizedSegments];
  }

  public getActiveSegment(): TranscriptSegment | null {
    return this.activeSegment ? { ...this.activeSegment } : null;
  }

  public reset(): void {
    this.clearSilenceTimer();
    this.activeSegment = null;
    this.finalizedSegments = [];
    this.notifyActiveUpdate();
  }

  /**
   * Robust text reconciliation for streaming speech recognition.
   * Handles:
   * 1. Direct extensions (e.g. "We are" -> "We are going")
   * 2. Overlapping chunks (e.g. "going to discuss" + "discuss the quarterly")
   * 3. Speech revisions / word corrections
   * 4. CJK character-level overlap (Japanese/Chinese/Korean without spaces)
   */
  /**
   * Core stream reconciliation algorithm:
   * 1. Substring & containment checks
   * 2. Sentence revision / prefix alignment (eliminates in-progress speech duplicate loops)
   * 3. Suffix-prefix overlap (stitches progressive streaming deltas)
   * 4. CJK character-level overlap
   * 5. Disjoint speech concatenation
   */
  public static reconcileText(current: string, incoming: string): string {
    const cur = current.trim();
    const inc = incoming.trim();

    if (!cur) return inc;
    if (!inc) return cur;
    if (cur === inc) return cur;

    // 1. Direct prefix / containment check
    if (inc.startsWith(cur)) {
      return inc;
    }
    if (cur.startsWith(inc)) {
      return cur;
    }
    if (cur.endsWith(inc)) {
      return cur;
    }

    const curWords = cur.split(/\s+/);
    const incWords = inc.split(/\s+/);

    const normCurWords = curWords.map(normalizeWord);
    const normIncWords = incWords.map(normalizeWord);

    // 2. Sentence revision & word overlap:
    // Finds where incoming text aligns with current text to replace intermediate speech drafts.
    let bestMatchIndex = -1;
    let maxMatchLen = 0;

    for (let i = 0; i < curWords.length; i++) {
      let matchLen = 0;
      while (
        i + matchLen < curWords.length &&
        matchLen < incWords.length &&
        normCurWords[i + matchLen] &&
        normIncWords[matchLen] &&
        normCurWords[i + matchLen] === normIncWords[matchLen]
      ) {
        matchLen++;
      }

      const isSuffixMatch = i + matchLen === curWords.length && matchLen >= 1;
      const isSubstantialMatch = matchLen >= 2;
      const isSingleWordBound = matchLen === 1 && (curWords.length === 1 || incWords.length === 1);

      if (isSubstantialMatch || isSuffixMatch || isSingleWordBound) {
        if (matchLen > maxMatchLen) {
          maxMatchLen = matchLen;
          bestMatchIndex = i;
        }
      }
    }

    if (bestMatchIndex !== -1 && maxMatchLen > 0) {
      const retainedPrefix = curWords.slice(0, bestMatchIndex).join(' ');
      return retainedPrefix ? `${retainedPrefix} ${inc}` : inc;
    }

    // 3. Character-level suffix-prefix overlap (essential for CJK: Chinese/Japanese/Korean)
    const maxCharOverlap = Math.min(cur.length, inc.length, 60);
    let bestCharOverlap = 0;

    for (let len = maxCharOverlap; len >= 2; len--) {
      const curEnd = cur.slice(-len).toLowerCase();
      const incStart = inc.slice(0, len).toLowerCase();

      if (curEnd === incStart) {
        bestCharOverlap = len;
        break;
      }
    }

    if (bestCharOverlap > 0) {
      const retainedChars = cur.slice(0, cur.length - bestCharOverlap);
      return `${retainedChars}${inc}`;
    }

    // 4. Fallback: Disjoint speech chunk within the same speaker turn
    const lastChar = cur.slice(-1);
    const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(
      lastChar
    );

    return isCJK ? `${cur}${inc}` : `${cur} ${inc}`;
  }

  /**
   * Strips text that has already been finalized in previous turns for this speaker.
   * This prevents persistent DOM captions in Google Meet from re-injecting
   * previously finalized sentences into subsequent turns.
   */
  private stripAlreadyFinalized(text: string, speaker: string): string {
    if (this.finalizedSegments.length === 0) return text;

    // Collect recent contiguous finalized segments for this speaker
    const speakerFinalizedTexts: string[] = [];
    for (let i = this.finalizedSegments.length - 1; i >= 0; i--) {
      const seg = this.finalizedSegments[i];
      if (seg.speaker === speaker) {
        speakerFinalizedTexts.unshift(seg.text);
      } else {
        break;
      }
    }

    if (speakerFinalizedTexts.length === 0) return text;

    const rawWords = text.split(/\s+/);
    const normRawWords = rawWords.map(normalizeWord);

    // Try stripping starting from all accumulated finalized texts down to the most recent turn
    for (let startIdx = 0; startIdx < speakerFinalizedTexts.length; startIdx++) {
      const combinedFinalized = speakerFinalizedTexts.slice(startIdx).join(' ');

      // 1. Direct fast prefix check
      if (text.startsWith(combinedFinalized)) {
        return text.slice(combinedFinalized.length).trim();
      }

      const finWords = combinedFinalized.split(/\s+/);
      const normFinWords = finWords.map(normalizeWord).filter(Boolean);
      if (normFinWords.length === 0) continue;

      // 2. Tail-anchor matching:
      // Look for the last 2..5 words of finalized text inside rawWords.
      // This is immune to Google Meet deleting or modifying filler words in the middle.
      const anchorLengths = [5, 4, 3, 2];
      for (const aLen of anchorLengths) {
        if (normFinWords.length >= aLen) {
          const anchor = normFinWords.slice(normFinWords.length - aLen);

          // Find where this anchor appears in normRawWords
          for (let r = 0; r <= normRawWords.length - aLen; r++) {
            let matched = true;
            for (let k = 0; k < aLen; k++) {
              if (normRawWords[r + k] !== anchor[k]) {
                matched = false;
                break;
              }
            }

            if (matched) {
              const cutIndex = r + aLen;
              return rawWords.slice(cutIndex).join(' ').trim();
            }
          }
        }
      }

      // 3. Fallback: Normalized prefix alignment
      let matchCount = 0;
      while (
        matchCount < normFinWords.length &&
        matchCount < normRawWords.length &&
        normFinWords[matchCount] === normRawWords[matchCount]
      ) {
        matchCount++;
      }

      // If all (or nearly all) finalized words match at the beginning of rawWords:
      if (
        matchCount >= normFinWords.length ||
        (normFinWords.length >= 4 && matchCount >= normFinWords.length - 1)
      ) {
        const remaining = rawWords.slice(matchCount).join(' ').trim();
        return remaining;
      }
    }

    return text;
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this.finalizeActiveTurn();
    }, this.turnSilenceThresholdMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private notifyFinalized(segment: TranscriptSegment): void {
    for (const cb of this.onFinalizedCallbacks) {
      try {
        cb(segment);
      } catch (err) {
        console.error('Error in onSegmentFinalized callback', err);
      }
    }
  }

  private notifyActiveUpdate(): void {
    const seg = this.getActiveSegment();
    for (const cb of this.onActiveUpdateCallbacks) {
      try {
        cb(seg);
      } catch (err) {
        console.error('Error in onActiveTurnUpdate callback', err);
      }
    }
  }
}
