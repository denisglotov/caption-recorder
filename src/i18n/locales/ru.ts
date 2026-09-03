import type { TranslationDict } from '../types';

export const ru: TranslationDict = {
  status: {
    idle: 'Готов',
    recording: 'Запись',
    paused: 'Пауза',
  },
  controls: {
    start: 'Начать запись',
    pause: 'Пауза',
    resume: 'Продолжить',
    stop: 'Остановить запись',
    openDrawer: 'Открыть панель',
    closeDrawer: 'Закрыть панель',
    minimize: 'Свернуть',
    maximize: 'Развернуть',
    newSession: 'Новая встреча',
  },
  nudge: {
    ccOff: 'Субтитры выключены. Включите субтитры (CC) в Google Meet для записи.',
    ccActive: 'Субтитры активны',
    noCaptionsYet: 'Ожидание речи...',
  },
  tabs: {
    live: 'Транскрипт',
    export: 'Экспорт',
  },
  export: {
    title: 'Экспорт встречи',
    downloadTxt: 'Скачать текст (.txt)',
    downloadMd: 'Скачать Markdown (.md)',
    downloadSrt: 'Скачать субтитры (.srt)',
    downloadVtt: 'Скачать субтитры (.vtt)',
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
    noDraft: 'Нет несохраненных встреч. Откройте Google Meet для начала записи.',
    saved: 'Черновик сохранен и очищен!',
  },
};
