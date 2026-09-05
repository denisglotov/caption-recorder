import type { TranslationDict } from '../types';

export const it: TranslationDict = {
  controls: {
    closePanel: 'Chiudi pannello',
    newSession: 'Nuova riunione',
    discardSession: 'Scarta sessione',
  },
  status: {
    idle: 'In attesa',
    recording: 'Registrazione',
    paused: 'In pausa',
  },
  metrics: {
    duration: 'Durata',
    speakers: 'Partecipanti',
    words: 'Parole',
    turns: 'Turni',
  },
  tabs: {
    live: 'Trascrizione in tempo reale',
    export: 'Esporta',
  },
  live: {
    recordingTitle: 'Registrazione sottotitoli',
    recordingDesc: 'In ascolto su Google Meet. Gli interventi appariranno qui in tempo reale.',
  },
  export: {
    title: 'Esporta trascrizione',
    subheading: 'Scegli il formato preferito per scaricare la registrazione.',
    copyClipboard: 'Copia trascrizione negli appunti',
    copied: 'Trascrizione copiata negli appunti!',
    sponsorGithub: 'Supporta su GitHub',
  },
  recovery: {
    title: 'Trovata riunione non salvata',
    description: 'È presente una trascrizione non salvata di una sessione precedente.',
    discard: 'Scarta',
    discardConfirm: 'Sei sicuro di voler scartare questa riunione non salvata?',
  },
  idle: {
    title: 'Pronto per le riunioni',
    desc: 'Apri Google Meet per registrare automaticamente i sottotitoli in tempo reale.',
  },
  pwaNotice: {
    badge: 'Caption Recorder',
    title: 'Registrazione in background',
    desc: 'Il pannello laterale è disponibile solo nelle schede standard del browser, ma i sottotitoli vengono registrati automaticamente.',
    close: 'Ho capito',
  },
};
