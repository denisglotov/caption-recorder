import type { TranslationDict } from '../types';

export const ru: TranslationDict = {
  controls: {
    openDrawer: 'Открыть панель',
    closeDrawer: 'Закрыть панель',
    newSession: 'Новая встреча',
  },
  nudge: {
    noCaptionsYet: 'Ожидание речи...',
  },
  tabs: {
    live: 'Транскрипт',
    export: 'Экспорт',
  },
  export: {
    copyClipboard: 'Скопировать в буфер обмена',
    copied: 'Транскрипт скопирован в буфер обмена!',
    totalWords: 'Всего слов',
    totalTurns: 'Реплик спикеров',
  },
  recovery: {
    title: 'Найдена несохраненная встреча',
    description: 'Обнаружен несохраненный транскрипт из предыдущей сессии.',
    recordedAt: 'Время записи',
    duration: 'Длительность',
    speakers: 'Участники',
    download: 'Экспортировать и сохранить',
    discard: 'Удалить',
    discardConfirm: 'Вы уверены, что хотите удалить эту несохраненную встречу?',
    saved: 'Черновик сохранен и очищен!',
  },
  popup: {
    idleTitle: 'Готов к встрече',
    idleDesc: 'Откройте Google Meet для автоматической записи живых субтитров.',
  },
};
