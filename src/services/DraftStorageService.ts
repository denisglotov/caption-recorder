import type { MeetingSession } from '../core/types';

const DRAFT_KEY = 'caption_recorder_unsaved_draft';

export class DraftStorageService {
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Save or update the active meeting draft with a debounce to minimize disk I/O.
   */
  public static async saveDraftDebounced(
    session: MeetingSession,
    delayMs: number = 800
  ): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    return new Promise((resolve) => {
      this.saveTimeout = setTimeout(async () => {
        await this.saveDraftImmediate(session);
        resolve();
      }, delayMs);
    });
  }

  /**
   * Immediately persist session draft to chrome.storage.local.
   */
  public static async saveDraftImmediate(session: MeetingSession): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({
          [DRAFT_KEY]: {
            ...session,
            savedAt: Date.now(),
          },
        });
      }
    } catch (err) {
      console.error('Failed to save draft to storage', err);
    }
  }

  /**
   * Retrieve unsaved draft if one exists.
   */
  public static async getUnsavedDraft(): Promise<MeetingSession | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const result = await chrome.storage.local.get(DRAFT_KEY);
        const draft = result[DRAFT_KEY];
        if (draft && Array.isArray(draft.segments) && draft.segments.length > 0) {
          return draft as MeetingSession;
        }
      }
    } catch (err) {
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

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.remove(DRAFT_KEY);
      }
    } catch (err) {
      console.error('Failed to clear draft from storage', err);
    }
  }
}
