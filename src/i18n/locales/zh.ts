import type { TranslationDict } from '../types';

export const zh: TranslationDict = {
  controls: {
    closePanel: '关闭面板',
    newSession: '新会议',
    discardSession: '舍弃会话',
  },
  status: {
    idle: '待机',
    recording: '录制中',
    paused: '已暂停',
  },
  metrics: {
    duration: '时长',
    speakers: '发言人',
    words: '词数',
    turns: '轮次',
  },
  tabs: {
    live: '实时转录',
    export: '导出',
  },
  live: {
    recordingTitle: '正在录制字幕',
    recordingDesc: '正在收听 Google Meet 语音。发言内容将实时显示在此处。',
  },
  export: {
    title: '导出转录',
    subheading: '选择您喜欢的文件格式以下载录音。',
    copyClipboard: '复制到剪贴板',
    copied: '转录内容已复制到剪贴板！',
    sponsorGithub: '在 GitHub 上赞助',
  },
  recovery: {
    title: '发现未保存的会议',
    description: '存在上次会议未保存的转录记录。',
    discard: '丢弃',
    discardConfirm: '确定要丢弃此未保存的会议记录吗？',
  },
  idle: {
    title: '就绪，等待会议',
    desc: '打开 Google Meet 即可自动录制实时字幕。',
  },
  pwaNotice: {
    badge: 'Caption Recorder',
    title: '正在后台录制',
    desc: '侧边栏仅在常规浏览器标签页中可用，但会议字幕已在后台自动录制并保存。',
    close: '知道了',
  },
};
