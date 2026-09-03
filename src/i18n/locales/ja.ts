import type { TranslationDict } from '../types';

export const ja: TranslationDict = {
  status: {
    idle: '待機中',
    recording: '録音中',
    paused: '一時停止',
  },
  controls: {
    start: '録音を開始',
    pause: '一時停止',
    resume: '再開',
    stop: '録音を停止',
    openDrawer: 'パネルを開く',
    closeDrawer: 'パネルを閉じる',
    minimize: '最小化',
    maximize: '展開',
    newSession: '新しいミーティング',
  },
  nudge: {
    ccOff: '字幕がオフです。録音するにはMeetの字幕（CC）をオンにしてください。',
    ccActive: '字幕は有効です',
    noCaptionsYet: '発言を待機中...',
  },
  tabs: {
    live: 'リアルタイム文字起こし',
    export: 'エクスポート',
  },
  export: {
    title: '会議をエクスポート',
    downloadTxt: 'テキストファイル保存 (.txt)',
    downloadMd: 'Markdown保存 (.md)',
    downloadSrt: '字幕ファイル保存 (.srt)',
    downloadVtt: '字幕ファイル保存 (.vtt)',
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
    noDraft: '未保存の会議はありません。Google Meetを開いて録音を開始してください。',
    saved: '下書きが保存され、消去されました！',
  },
};
