import type { TranslationDict } from '../types';

export const en: TranslationDict = {
  status: {
    idle: 'Idle',
    recording: 'Recording',
    paused: 'Paused',
  },
  controls: {
    start: 'Start Recording',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop Recording',
    openDrawer: 'Open Panel',
    closeDrawer: 'Close Panel',
    minimize: 'Minimize',
    maximize: 'Expand',
    newSession: 'New Meeting',
  },
  nudge: {
    ccOff: 'Captions are off. Turn on Closed Captions (CC) in Meet to record.',
    ccActive: 'Captions active',
    noCaptionsYet: 'Waiting for speech...',
  },
  tabs: {
    live: 'Live Transcript',
    export: 'Export',
  },
  export: {
    title: 'Export Meeting',
    downloadTxt: 'Download Plain Text (.txt)',
    downloadMd: 'Download Markdown (.md)',
    downloadSrt: 'Download Subtitles (.srt)',
    downloadVtt: 'Download Subtitles (.vtt)',
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
    noDraft: 'No unsaved meetings. Open Google Meet to start recording.',
    saved: 'Draft saved and cleared!',
  },
};
