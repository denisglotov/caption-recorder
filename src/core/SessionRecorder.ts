import type { PlatformAdapter } from '../adapters/PlatformAdapter';
import type {
  ExtensionMessage,
  InterimCaption,
  MeetingSession,
  RecordingStatus,
  TranscriptSegment,
} from './types';
import { DraftStorageService } from '../services/DraftStorageService';

export class SessionRecorder {
  private adapter: PlatformAdapter;
  private session: MeetingSession;
  private status: RecordingStatus = 'idle';
  private hasRecorded: boolean = false;
  private activeDraft: InterimCaption | null = null;
  public restorePromise: Promise<void> | null = null;

  private unloadHandler: () => void;
  private storageChangeHandler:
    ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null =
    null;
  private messageHandler:
    | ((
        message: unknown,
        sender: unknown,
        sendResponse: (response?: unknown) => void
      ) => boolean | void)
    | null = null;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;

    const now = Date.now();
    this.session = {
      id: `session_${now}`,
      title:
        typeof document !== 'undefined' ? document.title || this.adapter.name : this.adapter.name,
      startTime: now,
      segments: [],
      platform: this.adapter.platformId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.unloadHandler = () => this.handleUnload();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.unloadHandler);
      window.addEventListener('pagehide', this.unloadHandler);
    }

    this.restorePromise = this.restoreDraftSession();
    this.attachStorageListener();
    this.attachMessageListener();
    this.startObserving();
    this.checkCaptionsState();
  }

  public getSession(): MeetingSession {
    return this.session;
  }

  public getStatus(): RecordingStatus {
    return this.status;
  }

  public getActiveDraft(): InterimCaption | null {
    return this.activeDraft;
  }

  private startObserving(): void {
    this.adapter.observe(
      async (caption) => {
        if (this.restorePromise) {
          await this.restorePromise;
        }

        if (this.status !== 'recording' && this.adapter.isCaptionsEnabled()) {
          console.info('[SessionRecorder] Live captions detected, resuming recording session');
          this.resumeRecording();
        }

        const segmentId =
          caption.id || `seg_${caption.timestamp}_${Math.random().toString(36).slice(2, 8)}`;
        const existingIndex = this.session.segments.findIndex((s) => s.id === segmentId);

        if (existingIndex >= 0) {
          const existing = this.session.segments[existingIndex];
          existing.text = caption.text;
          existing.endTime = caption.timestamp;
          existing.speaker = caption.speaker;

          DraftStorageService.saveDraftDebounced(this.session);
          this.sendMessage({
            type: 'CR_UPDATE_TURN',
            segment: existing,
          });
          return;
        }

        const segment: TranscriptSegment = {
          id: segmentId,
          speaker: caption.speaker,
          startTime: caption.startTime || caption.timestamp,
          endTime: caption.timestamp,
          text: caption.text,
        };

        this.session.segments.push(segment);
        DraftStorageService.saveDraftDebounced(this.session);

        this.sendMessage({
          type: 'CR_NEW_TURN',
          segment,
        });
      },
      (enabled) => {
        this.handleCaptionsStateChange(enabled);
      },
      async (activeCaption) => {
        if (this.restorePromise) {
          await this.restorePromise;
        }

        this.activeDraft = activeCaption;
        if (activeCaption && this.status !== 'recording' && this.adapter.isCaptionsEnabled()) {
          console.info('[SessionRecorder] Live draft detected, resuming recording session');
          this.resumeRecording();
        }

        this.sendMessage({
          type: 'CR_ACTIVE_CAPTION',
          caption: activeCaption,
        });
      }
    );
  }

  public handleCaptionsStateChange(enabled: boolean): void {
    if (enabled) {
      this.resumeRecording();
    } else {
      this.pauseRecording();
    }
  }

  private resumeRecording(): void {
    if (this.status === 'recording') {
      return;
    }

    this.status = 'recording';
    this.hasRecorded = true;
    this.session.endTime = undefined;

    DraftStorageService.saveDraftImmediate(this.session);

    this.sendMessage({
      type: 'CR_STATUS_CHANGE',
      status: 'recording',
    });
  }

  private pauseRecording(): void {
    if (this.status === 'paused') {
      return;
    }

    const wasRecording = this.status === 'recording';
    this.status = this.hasRecorded || this.session.segments.length > 0 ? 'paused' : 'idle';

    this.sendMessage({
      type: 'CR_STATUS_CHANGE',
      status: this.status,
    });

    if (wasRecording) {
      this.adapter.flush?.();
      this.activeDraft = null;

      if (this.session.segments.length > 0) {
        DraftStorageService.saveDraftImmediate(this.session);
      }
    }
  }

  private checkCaptionsState(): void {
    const isEnabled = this.adapter.isCaptionsEnabled();
    this.handleCaptionsStateChange(isEnabled);
  }

  private async restoreDraftSession(): Promise<void> {
    try {
      const draft = await DraftStorageService.getUnsavedDraft();
      if (!draft || !Array.isArray(draft.segments) || draft.segments.length === 0) {
        return;
      }

      console.info(
        `[SessionRecorder] Restoring saved draft session (${draft.segments.length} segments, ${draft.id})`
      );

      this.session = {
        id: draft.id || this.session.id,
        title:
          draft.title ||
          (typeof document !== 'undefined'
            ? document.title || this.adapter.name
            : this.adapter.name),
        startTime: draft.startTime || this.session.startTime,
        endTime: draft.endTime,
        segments: [...draft.segments],
        platform: draft.platform || this.adapter.platformId,
        savedAt: draft.savedAt,
        url: draft.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      };

      this.hasRecorded = draft.segments.length > 0 || Boolean(draft.startTime);

      if (draft.endTime) {
        this.status = 'idle';
        this.sendMessage({ type: 'CR_STATUS_CHANGE', status: 'idle' });
      } else {
        this.checkCaptionsState();
      }
    } catch (err) {
      console.warn('[SessionRecorder] Failed to restore draft session', err);
    }
  }

  public async resetSession(clearStorage: boolean = true): Promise<void> {
    this.adapter.flush?.();

    if (clearStorage) {
      await DraftStorageService.clearDraft();
    }

    const now = Date.now();
    this.session = {
      id: `session_${now}`,
      title:
        typeof document !== 'undefined' ? document.title || this.adapter.name : this.adapter.name,
      startTime: now,
      segments: [],
      platform: this.adapter.platformId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.hasRecorded = false;
    this.activeDraft = null;

    const isEnabled = this.adapter.isCaptionsEnabled();
    if (isEnabled) {
      this.status = 'idle';
      this.resumeRecording();
    } else {
      this.status = 'idle';
      this.sendMessage({ type: 'CR_STATUS_CHANGE', status: 'idle' });
    }
  }

  private handleUnload(): void {
    try {
      this.adapter.flush?.();
      if (this.status === 'recording' || this.status === 'paused') {
        this.session.endTime = Date.now();
      }
      if (this.session.segments.length > 0 && DraftStorageService.isContextValid()) {
        DraftStorageService.saveDraftImmediate(this.session);
      }
      this.sendMessage({ type: 'CR_STATUS_CHANGE', status: 'idle' });
    } catch {
      // Silently ignore unload errors if context invalidated
    }
  }

  private attachStorageListener(): void {
    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      this.storageChangeHandler = (changes, areaName) => {
        if (!DraftStorageService.isContextValid()) return;
        if (areaName === 'local' && changes['caption_recorder_unsaved_draft']) {
          if (!changes['caption_recorder_unsaved_draft'].newValue) {
            if (this.status !== 'recording' && this.session.segments.length > 0) {
              this.resetSession(false);
            }
          }
        }
      };
      chrome.storage.onChanged.addListener(this.storageChangeHandler);
    }
  }

  private attachMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
      this.messageHandler = (message, _sender, sendResponse) => {
        if (!message || typeof message !== 'object') return;
        const msg = message as { type?: string };

        if (msg.type === 'CR_GET_STATUS') {
          sendResponse({
            status: this.status,
            session: this.session,
            activeDraft: this.activeDraft,
          });
          return true;
        }

        if (msg.type === 'CR_RESET_SESSION') {
          this.resetSession(true).then(() => {
            sendResponse({ success: true });
          });
          return true;
        }
      };
      chrome.runtime.onMessage.addListener(this.messageHandler);
    }
  }

  private sendMessage(message: ExtensionMessage): void {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage(message).catch(() => {
          // Ignored if receiver (side panel / background) isn't actively listening
        });
      } catch {
        // Ignored if context invalidated
      }
    }
  }

  public destroy(): void {
    this.handleUnload();

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.unloadHandler);
      window.removeEventListener('pagehide', this.unloadHandler);
    }

    if (this.storageChangeHandler && typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(this.storageChangeHandler);
      this.storageChangeHandler = null;
    }

    if (this.messageHandler && typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(this.messageHandler);
      this.messageHandler = null;
    }

    this.adapter.stop();
  }
}
