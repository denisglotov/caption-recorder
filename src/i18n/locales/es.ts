import type { TranslationDict } from '../types';

export const es: TranslationDict = {
  controls: {
    closePanel: 'Cerrar panel',
    newSession: 'Nueva reunión',
    discardSession: 'Descartar sesión',
  },
  status: {
    idle: 'En espera',
    recording: 'Grabando',
    paused: 'Pausado',
  },
  metrics: {
    duration: 'Duración',
    speakers: 'Participantes',
    words: 'Palabras',
    turns: 'Turnos',
  },
  tabs: {
    live: 'Transcripción en vivo',
    export: 'Exportar',
  },
  live: {
    recordingTitle: 'Grabando subtítulos',
    recordingDesc:
      'Escuchando voz en Google Meet. Las intervenciones aparecerán aquí en tiempo real.',
  },
  export: {
    title: 'Exportar transcripción',
    subheading: 'Elige tu formato preferido para descargar la grabación.',
    copyClipboard: 'Copiar transcripción al portapapeles',
    copied: '¡Transcripción copiada al portapapeles!',
  },
  recovery: {
    title: 'Reunión no guardada encontrada',
    description: 'Tienes una transcripción no guardada de una sesión de reunión anterior.',
    discard: 'Descartar',
    discardConfirm: '¿Estás seguro de que deseas descartar esta reunión no guardada?',
  },
  idle: {
    title: 'Listo para reuniones',
    desc: 'Abre Google Meet para grabar automáticamente subtítulos en vivo.',
  },
};
