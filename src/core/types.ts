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
  containerId?: string;
}

export interface MeetingSession {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  segments: TranscriptSegment[];
  aiSummary?: string;
  platform: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  savedAt?: number;
}

export type ExportFormat = 'txt' | 'md' | 'srt' | 'vtt';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

export interface AIModelStatus {
  available: boolean;
  status: 'readily' | 'after-download' | 'no' | 'unsupported-browser';
  message?: string;
}
