import type { TranslationDict } from '../types';

export const ja: TranslationDict = {
  controls: {
    openDrawer: 'パネルを開く',
    closeDrawer: 'パネルを閉じる',
    newSession: '新しいミーティング',
  },
  status: {
    idle: '待機中',
    recording: '録音中',
    paused: '一時停止',
  },
  metrics: {
    duration: '所要時間',
    speakers: '参加者',
    words: '単語数',
    turns: '発言回数',
  },
  nudge: {
    noCaptionsYet: '発言を待機中...',
  },
  tabs: {
    live: 'リアルタイム文字起こし',
    export: 'エクスポート',
  },
  live: {
    recordingTitle: '字幕を記録中',
    recordingDesc: 'Google Meet の音声を待機中。発言がリアルタイムでここに表示されます。',
  },
  export: {
    title: '文字起こしをエクスポート',
    subheading: 'ダウンロードする形式を選択してください。',
    copyClipboard: 'クリップボードにコピー',
    copied: '文字起こしをクリップボードにコピーしました！',
    totalWords: '総単語数',
    totalTurns: '発言回数',
  },
  recovery: {
    title: '未保存の会議が見つかりました',
    description: '前回のセッションから未保存の文字起こしデータがあります。',
    recordedAt: '録音日時',
    duration: '所要時間',
    speakers: '参加者',
    download: 'エクスポートして保存',
    discard: '破棄',
    discardConfirm: 'この未保存の会議データを破棄してもよろしいですか？',
    saved: '下書きが保存され、消去されました！',
  },
  popup: {
    idleTitle: 'ミーティング待機中',
    idleDesc: 'Google Meetを開くと、リアルタイム字幕が自動的に記録されます。',
  },
};
