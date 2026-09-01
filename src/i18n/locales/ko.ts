import type { TranslationDict } from '../types';

export const ko: TranslationDict = {
  status: {
    idle: '대기 중',
    recording: '기록 중',
    paused: '일시 정지',
  },
  controls: {
    start: '기록 시작',
    pause: '일시 정지',
    resume: '다시 시작',
    stop: '기록 중지',
    openDrawer: '패널 열기',
    closeDrawer: '패널 닫기',
    minimize: '최소화',
    maximize: '확대',
  },
  nudge: {
    ccOff: '자막이 꺼져 있습니다. 기록하려면 Meet에서 자막(CC)을 켜세요.',
    ccActive: '자막 활성화됨',
    noCaptionsYet: '대화 대기 중...',
  },
  tabs: {
    live: '실시간 전사',
    summary: 'AI 요약',
    export: '내보내기',
  },
  summary: {
    title: '회의 요약 및 실행 항목',
    generate: 'Gemini Nano로 요약 생성',
    generating: '기기에서 전사 내용을 분석 중...',
    ready: '요약 생성 완료',
    copy: '요약 복사',
    copied: '복사되었습니다!',
    notAvailable: '온디바이스 Gemini Nano를 현재 사용할 수 없습니다.',
    instructions:
      'chrome://flags/#optimization-guide-on-device-model 설정을 활성화하고 Chrome을 다시 시작하세요.',
    nonChrome:
      '온디바이스 Gemini Nano는 Google Chrome 전용입니다. 자막 기록과 파일 내보내기는 정상 동작합니다.',
    empty: '요약할 전사 내용이 아직 없습니다.',
  },
  export: {
    title: '회의 내보내기',
    downloadTxt: '텍스트 파일 다운로드 (.txt)',
    downloadMd: '마크다운 다운로드 (.md)',
    downloadSrt: '자막 파일 다운로드 (.srt)',
    downloadVtt: '자막 파일 다운로드 (.vtt)',
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
    noDraft: '저장되지 않은 회의가 없습니다. Google Meet을 열어 기록을 시작하세요.',
    saved: '임시 저장 데이터가 저장 및 정리되었습니다!',
  },
};
