import type { TranslationDict } from '../types';

export const zh: TranslationDict = {
  status: {
    idle: '空闲',
    recording: '正在录制',
    paused: '已暂停',
  },
  controls: {
    start: '开始录制',
    pause: '暂停',
    resume: '继续',
    stop: '停止录制',
    openDrawer: '打开面板',
    closeDrawer: '关闭面板',
    minimize: '最小化',
    maximize: '展开',
    newSession: '新会议',
  },
  nudge: {
    ccOff: '字幕已关闭。请在 Google Meet 中开启字幕（CC）以开始录制。',
    ccActive: '字幕已启用',
    noCaptionsYet: '等待语音输入...',
  },
  tabs: {
    live: '实时转录',
    export: '导出',
  },
  export: {
    title: '导出会议记录',
    downloadTxt: '下载纯文本 (.txt)',
    downloadMd: '下载 Markdown (.md)',
    downloadSrt: '下载字幕文件 (.srt)',
    downloadVtt: '下载字幕文件 (.vtt)',
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
    noDraft: '暂无未保存的会议。打开 Google Meet 即可开始录制。',
    saved: '草稿已保存并清理！',
  },
};
