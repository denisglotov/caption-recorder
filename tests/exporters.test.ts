import { describe, it, expect } from 'vitest';
import { exportToTxt, exportToMarkdown, exportToSrt, exportToVtt } from '../src/core/exporters';
import type { MeetingSession } from '../src/core/types';

describe('Exporters', () => {
  const sampleSession: MeetingSession = {
    id: 'test_meeting_1',
    title: 'Product Sync',
    startTime: 1700000000000,
    endTime: 1700000065000,
    platform: 'google-meet',
    aiSummary: 'Summary of discussion:\n- Shipped feature A\n- Next steps: feature B',
    segments: [
      {
        id: 'seg_1',
        speaker: 'Alice',
        startTime: 1700000000000,
        endTime: 1700000005000,
        text: 'Hello everyone, welcome to the sync.',
      },
      {
        id: 'seg_2',
        speaker: 'Bob',
        startTime: 1700000006000,
        endTime: 1700000012000,
        text: 'Thanks Alice, let us look at the numbers.',
      },
    ],
  };

  it('exports to clean Plain Text', () => {
    const txt = exportToTxt(sampleSession);
    expect(txt).toContain('MEETING TRANSCRIPT: Product Sync');
    expect(txt).toContain('Platform: google-meet');
    expect(txt).toContain('--- AI SUMMARY (Gemini Nano) ---');
    expect(txt).toContain('[00:00:00] Alice:');
    expect(txt).toContain('Hello everyone, welcome to the sync.');
    expect(txt).toContain('[00:00:06] Bob:');
  });

  it('exports to formatted Markdown', () => {
    const md = exportToMarkdown(sampleSession);
    expect(md).toContain('# Product Sync');
    expect(md).toContain('- **Platform**: google-meet');
    expect(md).toContain('- **Participants**: Alice, Bob');
    expect(md).toContain('## 🧠 AI Summary & Action Items');
    expect(md).toContain('## 📝 Transcript');
    expect(md).toContain('**[00:00:00] Alice**');
    expect(md).toContain('> Hello everyone, welcome to the sync.');
  });

  it('exports to standard SRT format with sequential indices and timecodes', () => {
    const srt = exportToSrt(sampleSession);
    expect(srt).toContain(
      '1\n00:00:00,000 --> 00:00:05,000\nAlice: Hello everyone, welcome to the sync.'
    );
    expect(srt).toContain(
      '2\n00:00:06,000 --> 00:00:12,000\nBob: Thanks Alice, let us look at the numbers.'
    );
  });

  it('exports to WebVTT format with WEBVTT header and speaker tags', () => {
    const vtt = exportToVtt(sampleSession);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:05.000');
    expect(vtt).toContain('<v Alice>Hello everyone, welcome to the sync.');
  });
});
