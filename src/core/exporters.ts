import type { MeetingSession } from './types';

export type ExportFormat = 'txt' | 'md' | 'srt' | 'vtt';

export interface ExportData {
  filename: string;
  content: string;
  mimeType: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatTime(timestamp: number, baseTimestamp: number): string {
  const diff = Math.max(0, timestamp - baseTimestamp);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatSrtTime(msOffset: number): string {
  const safeOffset = Math.max(0, msOffset);
  const hours = Math.floor(safeOffset / 3600000);
  const minutes = Math.floor((safeOffset % 3600000) / 60000);
  const seconds = Math.floor((safeOffset % 60000) / 1000);
  const ms = safeOffset % 1000;

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(ms)}`;
}

function formatVttTime(msOffset: number): string {
  return formatSrtTime(msOffset).replace(',', '.');
}

/**
 * Export meeting session to clean Plain Text (.txt)
 */
export function exportToTxt(session: MeetingSession): string {
  const lines: string[] = [];
  const baseTime = session.startTime;

  lines.push(`=======================================================`);
  lines.push(`MEETING TRANSCRIPT: ${session.title || 'Untitled Meeting'}`);
  lines.push(`Date: ${new Date(session.startTime).toLocaleString()}`);
  if (session.endTime) {
    lines.push(`Duration: ${formatDuration(session.endTime - session.startTime)}`);
  }
  lines.push(`Platform: ${session.platform}`);
  lines.push(`=======================================================\n`);

  lines.push(`--- FULL TRANSCRIPT ---\n`);
  for (const seg of session.segments) {
    const time = formatTime(seg.startTime, baseTime);
    lines.push(`[${time}] ${seg.speaker}:`);
    lines.push(`${seg.text}\n`);
  }

  return lines.join('\n');
}

/**
 * Export meeting session to structured Markdown (.md)
 */
export function exportToMarkdown(session: MeetingSession): string {
  const lines: string[] = [];
  const baseTime = session.startTime;
  const speakers = Array.from(new Set(session.segments.map((s) => s.speaker)));

  lines.push(`# ${session.title || 'Meeting Transcript'}\n`);
  lines.push(`- **Date**: ${new Date(session.startTime).toLocaleString()}`);
  if (session.endTime) {
    lines.push(`- **Duration**: ${formatDuration(session.endTime - session.startTime)}`);
  }
  lines.push(`- **Platform**: ${session.platform}`);
  lines.push(`- **Participants**: ${speakers.join(', ') || 'None'}\n`);

  lines.push(`## 📝 Transcript\n`);
  for (const seg of session.segments) {
    const time = formatTime(seg.startTime, baseTime);
    lines.push(`**[${time}] ${seg.speaker}**`);
    lines.push(`> ${seg.text}\n`);
  }

  return lines.join('\n');
}

/**
 * Export meeting session to SubRip Subtitle (.srt) format
 */
export function exportToSrt(session: MeetingSession): string {
  const blocks: string[] = [];
  const baseTime = session.startTime;

  session.segments.forEach((seg, index) => {
    const startOffset = seg.startTime - baseTime;
    // Guarantee at least 1.5 second duration for subtitle visibility
    const endOffset = Math.max(startOffset + 1500, seg.endTime - baseTime);

    const timecode = `${formatSrtTime(startOffset)} --> ${formatSrtTime(endOffset)}`;
    const text = `${seg.speaker}: ${seg.text}`;

    blocks.push(`${index + 1}\n${timecode}\n${text}\n`);
  });

  return blocks.join('\n');
}

/**
 * Export meeting session to WebVTT (.vtt) format
 */
export function exportToVtt(session: MeetingSession): string {
  const lines: string[] = ['WEBVTT\n'];
  const baseTime = session.startTime;

  session.segments.forEach((seg, index) => {
    const startOffset = seg.startTime - baseTime;
    const endOffset = Math.max(startOffset + 1500, seg.endTime - baseTime);

    const timecode = `${formatVttTime(startOffset)} --> ${formatVttTime(endOffset)}`;
    const text = `<v ${seg.speaker}>${seg.text}`;

    lines.push(`${index + 1}`);
    lines.push(timecode);
    lines.push(text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format meeting session and generate filename, content, and MIME type.
 */
export function exportSession(session: MeetingSession, format: ExportFormat): ExportData {
  const dateStr = new Date(session.startTime).toISOString().slice(0, 10);
  const cleanTitle = (session.title || 'Meeting').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `CaptionRecorder_${cleanTitle}_${dateStr}.${format}`;

  switch (format) {
    case 'txt':
      return { filename, content: exportToTxt(session), mimeType: 'text/plain' };
    case 'srt':
      return { filename, content: exportToSrt(session), mimeType: 'application/x-subrip' };
    case 'vtt':
      return { filename, content: exportToVtt(session), mimeType: 'text/vtt' };
    case 'md':
    default:
      return { filename, content: exportToMarkdown(session), mimeType: 'text/markdown' };
  }
}

/**
 * Trigger file download directly in browser
 */
export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Directly trigger download for a session in the requested format.
 */
export function downloadExport(session: MeetingSession, format: ExportFormat): void {
  const { filename, content, mimeType } = exportSession(session, format);
  triggerDownload(filename, content, mimeType);
}

/**
 * Copy text to clipboard safely
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
