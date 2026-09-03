import type { TranslationDict } from '../types';

export const it: TranslationDict = {
  status: {
    idle: 'In attesa',
    recording: 'Registrazione',
    paused: 'In pausa',
  },
  controls: {
    start: 'Avvia registrazione',
    pause: 'Pausa',
    resume: 'Riprendi',
    stop: 'Interrompi registrazione',
    openDrawer: 'Apri pannello',
    closeDrawer: 'Chiudi pannello',
    minimize: 'Riduci',
    maximize: 'Espandi',
    newSession: 'Nuova riunione',
  },
  nudge: {
    ccOff: 'I sottotitoli sono disattivati. Attiva i sottotitoli (CC) in Meet per registrare.',
    ccActive: 'Sottotitoli attivi',
    noCaptionsYet: 'In attesa del parlato...',
  },
  tabs: {
    live: 'Trascrizione in tempo reale',
    export: 'Esporta',
  },
  export: {
    title: 'Esporta riunione',
    downloadTxt: 'Scarica testo normale (.txt)',
    downloadMd: 'Scarica Markdown (.md)',
    downloadSrt: 'Scarica sottotitoli (.srt)',
    downloadVtt: 'Scarica sottotitoli (.vtt)',
    copyClipboard: 'Copia trascrizione negli appunti',
    copied: 'Trascrizione copiata negli appunti!',
    totalWords: 'Parole totali',
    totalTurns: 'Turni di parola',
  },
  recovery: {
    title: 'Trovata riunione non salvata',
    description: 'È presente una trascrizione non salvata di una sessione precedente.',
    recordedAt: 'Registrato il',
    duration: 'Durata',
    speakers: 'Partecipanti',
    download: 'Esporta e salva',
    discard: 'Scarta',
    discardConfirm: 'Sei sicuro di voler scartare questa riunione non salvata?',
    noDraft: 'Nessuna riunione non salvata. Apri Google Meet per iniziare a registrare.',
    saved: 'Bozza salvata e rimossa!',
  },
};
