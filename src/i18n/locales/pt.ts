import type { TranslationDict } from '../types';

export const pt: TranslationDict = {
  controls: {
    closePanel: 'Fechar painel',
    newSession: 'Nova reunião',
    discardSession: 'Descartar sessão',
  },
  status: {
    idle: 'Em espera',
    recording: 'Gravando',
    paused: 'Pausado',
  },
  metrics: {
    duration: 'Duração',
    speakers: 'Participantes',
    words: 'Palavras',
    turns: 'Turnos',
  },
  tabs: {
    live: 'Transcrição ao vivo',
    export: 'Exportar',
  },
  live: {
    recordingTitle: 'Gravando legendas',
    recordingDesc: 'Ouvindo a fala no Google Meet. As falas aparecerão aqui em tempo real.',
  },
  export: {
    title: 'Exportar transcrição',
    subheading: 'Escolha o formato de sua preferência para baixar sua gravação.',
    copyClipboard: 'Copiar transcrição para a área de transferência',
    copied: 'Transcrição copiada para a área de transferência!',
    sponsorGithub: 'Patrocinar no GitHub',
  },
  recovery: {
    title: 'Reunião não salva encontrada',
    description: 'Você tem uma transcrição não salva de uma sessão de reunião anterior.',
    discard: 'Descartar',
    discardConfirm: 'Tem certeza de que deseja descartar esta reunião não salva?',
  },
  idle: {
    title: 'Pronto para reuniões',
    desc: 'Abra o Google Meet para gravar automaticamente as legendas ao vivo.',
  },
  pwaNotice: {
    badge: 'Caption Recorder',
    title: 'Gravando em segundo plano',
    desc: 'O painel lateral está disponível apenas em guias normais do navegador, mas as legendas estão sendo gravadas automaticamente.',
    close: 'Entendi',
  },
};
