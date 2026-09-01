export interface TranslationDict {
  status: {
    idle: string;
    recording: string;
    paused: string;
  };
  controls: {
    start: string;
    pause: string;
    resume: string;
    stop: string;
    openDrawer: string;
    closeDrawer: string;
    minimize: string;
    maximize: string;
  };
  nudge: {
    ccOff: string;
    ccActive: string;
    noCaptionsYet: string;
  };
  tabs: {
    live: string;
    summary: string;
    export: string;
  };
  summary: {
    title: string;
    generate: string;
    generating: string;
    ready: string;
    copy: string;
    copied: string;
    notAvailable: string;
    instructions: string;
    nonChrome: string;
    empty: string;
  };
  export: {
    title: string;
    downloadTxt: string;
    downloadMd: string;
    downloadSrt: string;
    downloadVtt: string;
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
    noDraft: string;
    saved: string;
  };
}

export type SupportedLocale = 'en' | 'de' | 'fr' | 'ru' | 'ja' | 'ko' | 'zh';
