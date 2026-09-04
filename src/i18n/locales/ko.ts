import type { TranslationDict } from '../types';

export const ko: TranslationDict = {
  controls: {
    openDrawer: '패널 열기',
    closeDrawer: '패널 닫기',
    newSession: '새 회의',
  },
  status: {
    idle: '대기 중',
    recording: '기록 중',
    paused: '일시 정지',
  },
  metrics: {
    duration: '진행 시간',
    speakers: '참여자',
    words: '단어 수',
    turns: '발화 턴',
  },
  nudge: {
    noCaptionsYet: '대화 대기 중...',
  },
  tabs: {
    live: '실시간 전사',
    export: '내보내기',
  },
  live: {
    recordingTitle: '자막 기록 중',
    recordingDesc: 'Google Meet에서 음성을 대기 중입니다. 발언 내용이 실시간으로 표시됩니다.',
  },
  export: {
    title: '전사 내용 내보내기',
    subheading: '원하는 형식을 선택하여 녹음 데이터를 다운로드하세요.',
    copyClipboard: '클립보드에 복사',
    copied: '전사 내용이 클립보드에 복사되었습니다!',
    totalWords: '총 단어 수',
    totalTurns: '발화 턴',
  },
  recovery: {
    title: '저장되지 않은 회의 발견',
    description: '이전 회의 세션의 저장되지 않은 전사 데이터가 있습니다.',
    recordedAt: '기록 일시',
    duration: '진행 시간',
    speakers: '참여자',
    download: '내보내기 및 저장',
    discard: '삭제',
    discardConfirm: '저장되지 않은 회의 데이터를 삭제하시겠습니까?',
    saved: '임시 저장 데이터가 저장 및 정리되었습니다!',
  },
  popup: {
    idleTitle: '회의 준비 완료',
    idleDesc: 'Google Meet을 열어 실시간 자막을 자동으로 기록하세요.',
  },
};
