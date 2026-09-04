export interface TranscriptSegment {
  id: string;
  speaker: string;
  startTime: number; // Unix timestamp in ms
  endTime: number; // Unix timestamp in ms
  text: string;
}

export interface InterimCaption {
  speaker: string;
  text: string;
  timestamp: number;
  startTime?: number;
}

export interface MeetingSession {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  segments: TranscriptSegment[];
  platform: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  savedAt?: number;
  url?: string;
}

export type ExportFormat = 'txt' | 'md' | 'srt' | 'vtt';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

export type ExtensionMessage =
  | { type: 'CR_STATUS_CHANGE'; status: RecordingStatus }
  | { type: 'CR_NEW_TURN'; segment: TranscriptSegment }
  | { type: 'CR_ACTIVE_CAPTION'; caption: InterimCaption | null }
  | { type: 'CR_GET_STATUS' }
  | { type: 'CR_RESET_SESSION' };
