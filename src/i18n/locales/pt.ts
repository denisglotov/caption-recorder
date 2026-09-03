import type { TranslationDict } from '../types';

export const pt: TranslationDict = {
  controls: {
    openDrawer: 'Abrir painel',
    closeDrawer: 'Fechar painel',
    newSession: 'Nova reunião',
  },
  nudge: {
    noCaptionsYet: 'Aguardando fala...',
  },
  tabs: {
    live: 'Transcrição ao vivo',
    export: 'Exportar',
  },
  export: {
    copyClipboard: 'Copiar transcrição para a área de transferência',
    copied: 'Transcrição copiada para a área de transferência!',
    totalWords: 'Total de palavras',
    totalTurns: 'Turnos de fala',
  },
  recovery: {
    title: 'Reunião não salva encontrada',
    description: 'Você tem uma transcrição não salva de uma sessão de reunião anterior.',
    recordedAt: 'Gravado em',
    duration: 'Duração',
    speakers: 'Participantes',
    download: 'Exportar e salvar',
    discard: 'Descartar',
    discardConfirm: 'Tem certeza de que deseja descartar esta reunião não salva?',
    saved: 'Rascunho salvo e limpo!',
  },
  popup: {
    idleTitle: 'Pronto para reuniões',
    idleDesc: 'Abra o Google Meet para gravar automaticamente as legendas ao vivo.',
  },
};
