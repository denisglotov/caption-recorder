import type { TranslationDict } from '../types';

export const ja: TranslationDict = {
  controls: {
    closePanel: 'パネルを閉じる',
    newSession: '新しいミーティング',
    discardSession: 'セッションを破棄',
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
  },
  recovery: {
    title: '未保存の会議が見つかりました',
    description: '前回のセッションから未保存の文字起こしデータがあります。',
    discard: '破棄',
    discardConfirm: 'この未保存の会議データを破棄してもよろしいですか？',
  },
  idle: {
    title: 'ミーティング待機中',
    desc: 'Google Meetを開くと、リアルタイム字幕が自動的に記録されます。',
  },
  pwaNotice: {
    badge: 'Caption Recorder',
    title: 'バックグラウンドで録画中',
    desc: 'サイドパネルは通常のブラウザタブでのみ利用可能ですが、字幕はバックグラウンドで自動的に記録されています。',
    close: '了解',
  },
};
