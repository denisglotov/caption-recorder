import type { TranslationDict } from '../types';

export const de: TranslationDict = {
  status: {
    idle: 'Bereit',
    recording: 'Aufnahme läuft',
    paused: 'Pausiert',
  },
  controls: {
    start: 'Aufnahme starten',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    stop: 'Aufnahme stoppen',
    openDrawer: 'Panel öffnen',
    closeDrawer: 'Panel schließen',
    minimize: 'Minimieren',
    maximize: 'Vergrößern',
    newSession: 'Neues Meeting',
  },
  nudge: {
    ccOff: 'Untertitel sind deaktiviert. Bitte aktivieren Sie Untertitel (CC) in Meet.',
    ccActive: 'Untertitel aktiv',
    noCaptionsYet: 'Warten auf Sprache...',
  },
  tabs: {
    live: 'Live-Transkript',
    export: 'Exportieren',
  },
  export: {
    title: 'Meeting exportieren',
    downloadTxt: 'Textdatei herunterladen (.txt)',
    downloadMd: 'Markdown herunterladen (.md)',
    downloadSrt: 'Untertitel herunterladen (.srt)',
    downloadVtt: 'Untertitel herunterladen (.vtt)',
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
    noDraft: 'Keine ungespeicherten Meetings vorhanden.',
    saved: 'Entwurf gespeichert und bereinigt!',
  },
};
