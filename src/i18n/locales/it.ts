import type { TranslationDict } from '../types';

export const it: TranslationDict = {
  controls: {
    openDrawer: 'Apri pannello',
    closeDrawer: 'Chiudi pannello',
    newSession: 'Nuova riunione',
  },
  nudge: {
    noCaptionsYet: 'In attesa del parlato...',
  },
  tabs: {
    live: 'Trascrizione in tempo reale',
    export: 'Esporta',
  },
  export: {
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
    saved: 'Bozza salvata e rimossa!',
  },
  popup: {
    idleTitle: 'Pronto per le riunioni',
    idleDesc: 'Apri Google Meet per registrare automaticamente i sottotitoli in tempo reale.',
  },
};
