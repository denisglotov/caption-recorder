import type { TranslationDict } from '../types';

export const en: TranslationDict = {
  controls: {
    closePanel: 'Close Panel',
    newSession: 'New Meeting',
    discardSession: 'Discard Session',
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
  },
  recovery: {
    title: 'Unsaved Meeting Found',
    description: 'You have an unsaved transcript from a previous meeting session.',
    discard: 'Discard',
    discardConfirm: 'Are you sure you want to discard this unsaved meeting?',
  },
  idle: {
    title: 'Ready for Meetings',
    desc: 'Open Google Meet to automatically record live closed captions.',
  },
};
