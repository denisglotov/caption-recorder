import type { TranslationDict } from '../types';

export const es: TranslationDict = {
  controls: {
    openDrawer: 'Abrir panel',
    closeDrawer: 'Cerrar panel',
    newSession: 'Nueva reunión',
  },
  nudge: {
    noCaptionsYet: 'Esperando voz...',
  },
  tabs: {
    live: 'Transcripción en vivo',
    export: 'Exportar',
  },
  export: {
    copyClipboard: 'Copiar transcripción al portapapeles',
    copied: '¡Transcripción copiada al portapapeles!',
    totalWords: 'Palabras totales',
    totalTurns: 'Turnos de palabra',
  },
  recovery: {
    title: 'Reunión no guardada encontrada',
    description: 'Tienes una transcripción no guardada de una sesión de reunión anterior.',
    recordedAt: 'Grabado el',
    duration: 'Duración',
    speakers: 'Participantes',
    download: 'Exportar y guardar',
    discard: 'Descartar',
    discardConfirm: '¿Estás seguro de que deseas descartar esta reunión no guardada?',
    saved: '¡Borrador guardado y eliminado!',
  },
  popup: {
    idleTitle: 'Listo para reuniones',
    idleDesc: 'Abre Google Meet para grabar automáticamente subtítulos en vivo.',
  },
};
