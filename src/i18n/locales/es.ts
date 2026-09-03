import type { TranslationDict } from '../types';

export const es: TranslationDict = {
  status: {
    idle: 'En espera',
    recording: 'Grabando',
    paused: 'En pausa',
  },
  controls: {
    start: 'Iniciar grabación',
    pause: 'Pausar',
    resume: 'Reanudar',
    stop: 'Detener grabación',
    openDrawer: 'Abrir panel',
    closeDrawer: 'Cerrar panel',
    minimize: 'Minimizar',
    maximize: 'Expandir',
    newSession: 'Nueva reunión',
  },
  nudge: {
    ccOff: 'Los subtítulos están desactivados. Activa los subtítulos (CC) en Meet para grabar.',
    ccActive: 'Subtítulos activos',
    noCaptionsYet: 'Esperando voz...',
  },
  tabs: {
    live: 'Transcripción en vivo',
    export: 'Exportar',
  },
  export: {
    title: 'Exportar reunión',
    downloadTxt: 'Descargar texto plano (.txt)',
    downloadMd: 'Descargar Markdown (.md)',
    downloadSrt: 'Descargar subtítulos (.srt)',
    downloadVtt: 'Descargar subtítulos (.vtt)',
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
    noDraft: 'No hay reuniones sin guardar. Abre Google Meet para comenzar a grabar.',
    saved: '¡Borrador guardado y eliminado!',
  },
};
