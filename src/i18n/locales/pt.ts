import type { TranslationDict } from '../types';

export const pt: TranslationDict = {
  status: {
    idle: 'Inativo',
    recording: 'Gravando',
    paused: 'Pausado',
  },
  controls: {
    start: 'Iniciar gravação',
    pause: 'Pausar',
    resume: 'Retomar',
    stop: 'Parar gravação',
    openDrawer: 'Abrir painel',
    closeDrawer: 'Fechar painel',
    minimize: 'Minimizar',
    maximize: 'Expandir',
    newSession: 'Nova reunião',
  },
  nudge: {
    ccOff: 'As legendas estão desativadas. Ative as legendas (CC) no Meet para gravar.',
    ccActive: 'Legendas ativas',
    noCaptionsYet: 'Aguardando fala...',
  },
  tabs: {
    live: 'Transcrição ao vivo',
    export: 'Exportar',
  },
  export: {
    title: 'Exportar reunião',
    downloadTxt: 'Baixar texto simples (.txt)',
    downloadMd: 'Baixar Markdown (.md)',
    downloadSrt: 'Baixar legendas (.srt)',
    downloadVtt: 'Baixar legendas (.vtt)',
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
    noDraft: 'Nenhuma reunião não salva. Abra o Google Meet para iniciar a gravação.',
    saved: 'Rascunho salvo e limpo!',
  },
};
