import type { TranslationDict } from '../types';

export const fr: TranslationDict = {
  controls: {
    openDrawer: 'Ouvrir le panneau',
    closeDrawer: 'Fermer le panneau',
    newSession: 'Nouvelle réunion',
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
  nudge: {
    noCaptionsYet: 'En attente de prise de parole...',
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
    totalWords: 'Total de mots',
    totalTurns: 'Prises de parole',
  },
  recovery: {
    title: 'Réunion non enregistrée trouvée',
    description: 'Une transcription non enregistrée d’une session précédente est disponible.',
    recordedAt: 'Enregistré à',
    duration: 'Durée',
    speakers: 'Intervenants',
    download: 'Exporter et enregistrer',
    discard: 'Ignorer',
    discardConfirm: 'Êtes-vous sûr de vouloir supprimer cette réunion non enregistrée ?',
    saved: 'Brouillon enregistré et effacé !',
  },
  popup: {
    idleTitle: 'Prêt pour les réunions',
    idleDesc: 'Ouvrez Google Meet pour enregistrer automatiquement les sous-titres en direct.',
  },
};
