import type { TranslationDict } from '../types';

export const zh: TranslationDict = {
  controls: {
    openDrawer: '打开面板',
    closeDrawer: '关闭面板',
    newSession: '新会议',
  },
  nudge: {
    noCaptionsYet: '等待语音输入...',
  },
  tabs: {
    live: '实时转录',
    export: '导出',
  },
  export: {
    copyClipboard: '复制到剪贴板',
    copied: '转录内容已复制到剪贴板！',
    totalWords: '总词数',
    totalTurns: '发言轮次',
  },
  recovery: {
    title: '发现未保存的会议',
    description: '存在上次会议未保存的转录记录。',
    recordedAt: '录制时间',
    duration: '时长',
    speakers: '发言人',
    download: '导出并保存',
    discard: '丢弃',
    discardConfirm: '确定要丢弃此未保存的会议记录吗？',
    saved: '草稿已保存并清理！',
  },
  popup: {
    idleTitle: '就绪，等待会议',
    idleDesc: '打开 Google Meet 即可自动录制实时字幕。',
  },
};
