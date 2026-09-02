import type { TranslationDict } from '../types';

export const fr: TranslationDict = {
  status: {
    idle: 'En attente',
    recording: 'Enregistrement',
    paused: 'En pause',
  },
  controls: {
    start: "Démarrer l'enregistrement",
    pause: 'Mettre en pause',
    resume: 'Reprendre',
    stop: "Arrêter l'enregistrement",
    openDrawer: 'Ouvrir le panneau',
    closeDrawer: 'Fermer le panneau',
    minimize: 'Réduire',
    maximize: 'Agrandir',
    newSession: 'Nouvelle réunion',
  },
  nudge: {
    ccOff: 'Sous-titres désactivés. Activez les sous-titres (CC) dans Meet pour enregistrer.',
    ccActive: 'Sous-titres actifs',
    noCaptionsYet: 'En attente de prise de parole...',
  },
  tabs: {
    live: 'Transcription en direct',
    summary: 'Résumé IA',
    export: 'Exporter',
  },
  summary: {
    title: 'Résumé & Plans d’action',
    generate: 'Générer avec Gemini Nano',
    generating: 'Analyse locale de la transcription...',
    ready: 'Résumé généré',
    copy: 'Copier le résumé',
    copied: 'Copié !',
    notAvailable: 'Gemini Nano local n’est pas disponible actuellement.',
    instructions:
      'Activez chrome://flags/#optimization-guide-on-device-model et redémarrez Chrome.',
    nonChrome:
      'Gemini Nano local est exclusif à Google Chrome. L’enregistrement et l’export fonctionnent normalement.',
    empty: 'Aucune transcription disponible à résumer pour le moment.',
    languageAuto: 'Auto (comme la réunion)',
  },
  export: {
    title: 'Exporter la réunion',
    downloadTxt: 'Télécharger Texte (.txt)',
    downloadMd: 'Télécharger Markdown (.md)',
    downloadSrt: 'Télécharger Sous-titres (.srt)',
    downloadVtt: 'Télécharger Sous-titres (.vtt)',
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
    noDraft: 'Aucune réunion non enregistrée. Ouvrez Google Meet pour commencer.',
    saved: 'Brouillon enregistré et effacé !',
  },
};
