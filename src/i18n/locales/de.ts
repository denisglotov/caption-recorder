import type { TranslationDict } from '../types';

export const de: TranslationDict = {
  controls: {
    closePanel: 'Panel schließen',
    newSession: 'Neues Meeting',
    discardSession: 'Sitzung verwerfen',
  },
  status: {
    idle: 'Bereit',
    recording: 'Aufnahme',
    paused: 'Pausiert',
  },
  metrics: {
    duration: 'Dauer',
    speakers: 'Sprecher',
    words: 'Wörter',
    turns: 'Wechsel',
  },
  tabs: {
    live: 'Live-Transkript',
    export: 'Exportieren',
  },
  live: {
    recordingTitle: 'Untertitel werden aufgezeichnet',
    recordingDesc: 'Warten auf Sprache in Google Meet. Wortmeldungen erscheinen hier in Echtzeit.',
  },
  export: {
    title: 'Transkript exportieren',
    subheading: 'Wählen Sie das gewünschte Format zum Herunterladen Ihrer Aufnahme.',
    copyClipboard: 'In Zwischenablage kopieren',
    copied: 'Transkript in Zwischenablage kopiert!',
  },
  recovery: {
    title: 'Nicht gespeichertes Meeting gefunden',
    description: 'Es gibt ein ungespeichertes Transkript aus einer vorherigen Sitzung.',
    discard: 'Verwerfen',
    discardConfirm: 'Möchten Sie dieses ungespeicherte Meeting wirklich verwerfen?',
  },
  idle: {
    title: 'Bereit für Meetings',
    desc: 'Öffnen Sie Google Meet, um Live-Untertitel automatisch aufzuzeichnen.',
  },
  pwaNotice: {
    badge: 'Caption Recorder',
    title: 'Aufnahme im Hintergrund',
    desc: 'Die Seitenleiste ist nur in regulären Browser-Tabs verfügbar, aber Untertitel werden automatisch im Hintergrund aufgezeichnet.',
    close: 'Verstanden',
  },
};
