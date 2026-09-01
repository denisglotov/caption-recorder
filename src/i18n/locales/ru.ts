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
  },
  nudge: {
    ccOff: 'Субтитры выключены. Включите субтитры (CC) в Google Meet для записи.',
    ccActive: 'Субтитры активны',
    noCaptionsYet: 'Ожидание речи...',
  },
  tabs: {
    live: 'Транскрипт',
    summary: 'ИИ-Сводка',
    export: 'Экспорт',
  },
  summary: {
    title: 'Сводка встречи и задачи',
    generate: 'Создать с Gemini Nano',
    generating: 'Анализ транскрипта на устройстве...',
    ready: 'Сводка готова',
    copy: 'Скопировать сводку',
    copied: 'Скопировано!',
    notAvailable: 'Локальная модель Gemini Nano сейчас недоступна.',
    instructions:
      'Включите chrome://flags/#optimization-guide-on-device-model и перезапустите Chrome.',
    nonChrome:
      'Локальный Gemini Nano доступен только в Google Chrome. Запись субтитров и экспорт работают штатно.',
    empty: 'Пока нет транскрипта для создания сводки.',
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
