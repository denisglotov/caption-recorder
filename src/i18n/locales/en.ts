import type { TranslationDict } from '../types';

export const en: TranslationDict = {
  controls: {
    openDrawer: 'Open Panel',
    closeDrawer: 'Close Panel',
    newSession: 'New Meeting',
  },
  status: {
    idle: 'Idle',
    recording: 'Recording',
    paused: 'Paused',
  },
  metrics: {
    duration: 'Duration',
    speakers: 'Speakers',
    words: 'Words',
    turns: 'Turns',
  },
  nudge: {
    noCaptionsYet: 'Waiting for speech...',
  },
  tabs: {
    live: 'Live Transcript',
    export: 'Export',
  },
  live: {
    recordingTitle: 'Recording Captions',
    recordingDesc:
      'Listening for speech in Google Meet. Spoken turns will appear here in real time.',
  },
  export: {
    title: 'Export Transcript',
    subheading: 'Choose your preferred format to download your recording.',
    copyClipboard: 'Copy Transcript to Clipboard',
    copied: 'Transcript copied to clipboard!',
    totalWords: 'Total words',
    totalTurns: 'Speaker turns',
  },
  recovery: {
    title: 'Unsaved Meeting Found',
    description: 'You have an unsaved transcript from a previous meeting session.',
    recordedAt: 'Recorded at',
    duration: 'Duration',
    speakers: 'Speakers',
    download: 'Export & Save',
    discard: 'Discard',
    discardConfirm: 'Are you sure you want to discard this unsaved meeting?',
    saved: 'Draft saved and cleared!',
  },
  popup: {
    idleTitle: 'Ready for Meetings',
    idleDesc: 'Open Google Meet to automatically record live closed captions.',
  },
};
