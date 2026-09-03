import type { TranslationDict } from '../types';

export const de: TranslationDict = {
  controls: {
    openDrawer: 'Panel öffnen',
    closeDrawer: 'Panel schließen',
    newSession: 'Neues Meeting',
  },
  nudge: {
    noCaptionsYet: 'Warten auf Sprache...',
  },
  tabs: {
    live: 'Live-Transkript',
    export: 'Exportieren',
  },
  export: {
    copyClipboard: 'In Zwischenablage kopieren',
    copied: 'Transkript in Zwischenablage kopiert!',
    totalWords: 'Wörter gesamt',
    totalTurns: 'Sprecherwechsel',
  },
  recovery: {
    title: 'Nicht gespeichertes Meeting gefunden',
    description: 'Es gibt ein ungespeichertes Transkript aus einer vorherigen Sitzung.',
    recordedAt: 'Aufgenommen am',
    duration: 'Dauer',
    speakers: 'Sprecher',
    download: 'Exportieren & Speichern',
    discard: 'Verwerfen',
    discardConfirm: 'Möchten Sie dieses ungespeicherte Meeting wirklich verwerfen?',
    saved: 'Entwurf gespeichert und bereinigt!',
  },
  popup: {
    idleTitle: 'Bereit für Meetings',
    idleDesc: 'Öffnen Sie Google Meet, um Live-Untertitel automatisch aufzuzeichnen.',
  },
};
