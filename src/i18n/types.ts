export interface TranslationDict {
  controls: {
    openDrawer: string;
    closeDrawer: string;
    newSession: string;
  };
  status: {
    idle: string;
    recording: string;
    paused: string;
  };
  metrics: {
    duration: string;
    speakers: string;
    words: string;
    turns: string;
  };
  nudge: {
    noCaptionsYet: string;
  };
  tabs: {
    live: string;
    export: string;
  };
  live: {
    recordingTitle: string;
    recordingDesc: string;
  };
  export: {
    title: string;
    subheading: string;
    copyClipboard: string;
    copied: string;
    totalWords: string;
    totalTurns: string;
  };
  recovery: {
    title: string;
    description: string;
    recordedAt: string;
    duration: string;
    speakers: string;
    download: string;
    discard: string;
    discardConfirm: string;
    saved: string;
  };
  popup: {
    idleTitle: string;
    idleDesc: string;
  };
}

export type SupportedLocale = 'en' | 'de' | 'fr' | 'ru' | 'ja' | 'ko' | 'zh' | 'it' | 'pt' | 'es';
