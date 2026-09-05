# Firefox Add-ons (AMO) Listing: CaptionRecorder

**Target Browser**: Mozilla Firefox (Manifest V3)  
**Version**: 1.1.0  
**Category**: Productivity / Appearance & Accents (Accessibility)

---

## 1. Summary

> **Field Limit**: Max 250 characters.  
> **Character Count**: 238 characters.

```text
A lightweight, privacy-first add-on that records live closed captions from Google Meet,
tracks speaker turns in real time, and exports clean transcripts to TXT, Markdown, SRT,
and VTT—100% locally on your device with zero data collection.
```

---

## 2. Description

> **Display**: Product details page.  
> **First 250 Characters**: Fully self-contained summary of core features and benefits.

### Copy-Paste Markdown for AMO:

CaptionRecorder is a featherweight, 100% private add-on that captures live closed captions and
speaker turns in Google Meet. Follow transcripts live in your sidebar and export clean notes or
subtitles to Markdown, TXT, SRT, or VTT with zero setup.

### ✨ Why You'll Love It

- 🔒 **100% Private & On-Device**: Zero telemetry, no external servers, and no account required.
  Your meeting conversations stay strictly on your computer.
- 🪶 **Clean & Non-Intrusive**: No floating overlays, watermark badges, or clutter over your video
  call. A subtle `REC` badge in your toolbar confirms active recording.
- ⚡ **Smart Turn Tracking**: Captures real-time caption updates and cleanly groups dialogue by
  speaker without stutter or duplicated phrases.
- 📑 **Sidebar View**: Click the toolbar icon to view live transcripts, speech duration, and word
  counts alongside your meeting.
- 💾 **Session Recovery**: Accidental tab closure or refresh? CaptionRecorder buffers active
  sessions locally so you can easily restore unsaved transcripts.
- 📁 **Flexible Exports**: Export formatted Markdown (`.md`), Text (`.txt`), SubRip (`.srt`), or
  WebVTT (`.vtt`), or copy directly to clipboard with one click.
- 🌐 **Languages**: Supports English, Spanish, Portuguese, Italian, German, French, Russian,
  Japanese, Korean, and Simplified Chinese.

---

### 🚀 Quick Start & How to Test (For Users & Reviewers)

1. Join any call on [Google Meet](https://meet.google.com).
2. Turn on captions by clicking the **CC** button (or press `c` on your keyboard).
3. The toolbar icon will display a red **`REC`** badge indicating live recording.
4. Click the **CaptionRecorder icon** in the toolbar (or open your Firefox Sidebar) to follow the
   live transcript, view speaker turns, and export in your preferred format.

---

### 🛡️ Permissions Disclosures

- `storage`: Buffers your ongoing meeting transcript in local storage to prevent data loss if a call
  drops or a tab reloads.
- `tabs`: Synchronizes the sidebar transcript viewer with the active Google Meet tab.
- `meet.google.com/*`: Reads closed caption elements displayed during active meetings.
