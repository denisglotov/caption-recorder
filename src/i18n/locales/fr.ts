import type { TranslationDict } from '../types';

export const fr: TranslationDict = {
  controls: {
    openDrawer: 'Ouvrir le panneau',
    closeDrawer: 'Fermer le panneau',
    newSession: 'Nouvelle réunion',
  },
  nudge: {
    noCaptionsYet: 'En attente de prise de parole...',
  },
  tabs: {
    live: 'Transcription en direct',
    export: 'Exporter',
  },
  export: {
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
