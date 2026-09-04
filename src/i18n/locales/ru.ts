import type { TranslationDict } from '../types';

export const ru: TranslationDict = {
  controls: {
    closePanel: 'Закрыть панель',
    newSession: 'Новая встреча',
    discardSession: 'Сбросить сессию',
  },
  status: {
    idle: 'Ожидание',
    recording: 'Запись',
    paused: 'Пауза',
  },
  metrics: {
    duration: 'Длительность',
    speakers: 'Участники',
    words: 'Слова',
    turns: 'Реплики',
  },
  tabs: {
    live: 'Транскрипт',
    export: 'Экспорт',
  },
  live: {
    recordingTitle: 'Запись субтитров',
    recordingDesc: 'Ожидание речи в Google Meet. Реплики появятся здесь в реальном времени.',
  },
  export: {
    title: 'Экспорт транскрипта',
    subheading: 'Выберите формат для скачивания вашей записи.',
    copyClipboard: 'Скопировать в буфер обмена',
    copied: 'Транскрипт скопирован в буфер обмена!',
  },
  recovery: {
    title: 'Найдена несохраненная встреча',
    description: 'Обнаружен несохраненный транскрипт из предыдущей сессии.',
    discard: 'Удалить',
    discardConfirm: 'Вы уверены, что хотите удалить эту несохраненную встречу?',
  },
  idle: {
    title: 'Готов к встрече',
    desc: 'Откройте Google Meet для автоматической записи живых субтитров.',
  },
};
