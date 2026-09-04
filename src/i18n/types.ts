export interface TranslationDict {
  controls: {
    closePanel: string;
    newSession: string;
    discardSession: string;
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
  };
  recovery: {
    title: string;
    description: string;
    discard: string;
    discardConfirm: string;
  };
  idle: {
    title: string;
    desc: string;
  };
}

export type SupportedLocale = 'en' | 'de' | 'fr' | 'ru' | 'ja' | 'ko' | 'zh' | 'it' | 'pt' | 'es';
