import type { MeetingSession } from '../core/types';

const DRAFT_KEY = 'caption_recorder_unsaved_draft';

export class DraftStorageService {
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private static pendingResolves: (() => void)[] = [];

  /**
   * Check if Chrome extension context is still valid.
   * When an extension is reloaded or updated, existing content scripts become orphaned
   * and calling chrome APIs throws "Extension context invalidated".
   */
  public static isContextValid(): boolean {
    try {
      const g = globalThis as unknown as {
        browser?: { runtime?: { id?: string }; storage?: { local?: unknown } };
        chrome?: { runtime?: { id?: string }; storage?: { local?: unknown } };
      };
      const runtime = g.browser?.runtime || g.chrome?.runtime;
      if (runtime && !runtime.id) return false;
      return Boolean(g.browser?.storage?.local || g.chrome?.storage?.local);
    } catch {
      return false;
    }
  }

  private static get storage() {
    const g = globalThis as unknown as {
      browser?: typeof chrome;
      chrome?: typeof chrome;
    };
    return g.browser?.storage?.local || g.chrome?.storage?.local;
  }

  /**
   * Save or update the active meeting draft with a debounce to minimize disk I/O.
   */
  public static async saveDraftDebounced(
    session: MeetingSession,
    delayMs: number = 800
  ): Promise<void> {
    if (!this.isContextValid()) {
      return;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    return new Promise((resolve) => {
      this.pendingResolves.push(resolve);
      this.saveTimeout = setTimeout(async () => {
        this.saveTimeout = null;
        await this.saveDraftImmediate(session);
      }, delayMs);
    });
  }

  /**
   * Immediately persist session draft to storage.local.
   */
  public static async saveDraftImmediate(session: MeetingSession): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const currentResolves = this.pendingResolves;
    this.pendingResolves = [];

    if (!this.isContextValid()) {
      currentResolves.forEach((r) => r());
      return;
    }

    try {
      await this.storage?.set({
        [DRAFT_KEY]: {
          ...session,
          savedAt: Date.now(),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Extension context invalidated')) {
        return;
      }
      console.error('Failed to save draft to storage', err);
    } finally {
      currentResolves.forEach((r) => r());
    }
  }

  /**
   * Retrieve unsaved draft if one exists.
   * @param includeEmpty If true, returns an active session draft even if 0 segments have been recorded yet.
   */
  public static async getUnsavedDraft(
    includeEmpty: boolean = false
  ): Promise<MeetingSession | null> {
    if (!this.isContextValid()) {
      return null;
    }

    try {
      const result = await this.storage?.get(DRAFT_KEY);
      const draft = result?.[DRAFT_KEY] as MeetingSession | undefined;
      if (draft && Array.isArray(draft.segments) && (includeEmpty || draft.segments.length > 0)) {
        return draft;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Extension context invalidated')) {
        return null;
      }
      console.error('Failed to read draft from storage', err);
    }
    return null;
  }

  /**
   * Clear the active draft from storage after user saves or discards it.
   */
  public static async clearDraft(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const currentResolves = this.pendingResolves;
    this.pendingResolves = [];
    currentResolves.forEach((r) => r());

    if (!this.isContextValid()) {
      return;
    }

    try {
      await this.storage?.remove(DRAFT_KEY);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Extension context invalidated')) {
        return;
      }
      console.error('Failed to clear draft from storage', err);
    }
  }
}
