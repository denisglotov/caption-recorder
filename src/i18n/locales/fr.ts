import type { TranslationDict } from '../types';

export const fr: TranslationDict = {
  controls: {
    closePanel: 'Fermer le panneau',
    newSession: 'Nouvelle réunion',
    discardSession: 'Ignorer la session',
  },
  status: {
    idle: 'En attente',
    recording: 'Enregistrement',
    paused: 'En pause',
  },
  metrics: {
    duration: 'Durée',
    speakers: 'Intervenants',
    words: 'Mots',
    turns: 'Prises',
  },
  tabs: {
    live: 'Transcription en direct',
    export: 'Exporter',
  },
  live: {
    recordingTitle: 'Enregistrement des sous-titres',
    recordingDesc: 'À l’écoute dans Google Meet. Les prises de parole apparaîtront ici en direct.',
  },
  export: {
    title: 'Exporter la transcription',
    subheading: 'Choisissez votre format préféré pour télécharger votre enregistrement.',
    copyClipboard: 'Copier dans le presse-papiers',
    copied: 'Transcription copiée dans le presse-papiers !',
  },
  recovery: {
    title: 'Réunion non enregistrée trouvée',
    description: 'Une transcription non enregistrée d’une session précédente est disponible.',
    discard: 'Ignorer',
    discardConfirm: 'Êtes-vous sûr de vouloir supprimer cette réunion non enregistrée ?',
  },
  idle: {
    title: 'Prêt pour les réunions',
    desc: 'Ouvrez Google Meet pour enregistrer automatiquement les sous-titres en direct.',
  },
};
