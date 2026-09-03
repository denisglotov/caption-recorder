# Chrome Web Store Listing: CaptionRecorder

**Last Updated**: 2026-09-03  
**Version**: 1.1.0  
**Target Browser**: Chrome (Manifest V3), Firefox (Manifest V3), Safari  

## Listing Metadata

- **Extension Name**: CaptionRecorder — Live Captions & Transcripts
- **Short Description**: Record live closed captions from Google Meet with instant speaker turn tracking, and export to TXT, Markdown, SRT, and WebVTT.
- **Category**: Productivity / Accessibility
- **Default Language**: English (UI natively supports EN, ES, PT, IT, DE, FR, RU, JA, KO, ZH)


## Detailed Description

CaptionRecorder is a 100% private, on-device Chrome extension that records live closed captions during your Google Meet calls, tracks real-time speaker turns with instant finalization, and exports clean transcripts to Markdown, TXT, SRT, or WebVTT.

### Key Highlights
- 🔒 **Zero Data Collection**: No servers, no telemetry, no third-party APIs, no API keys needed. All processing and caption recording run 100% locally on your device.
- ⚡ **Switch-Driven Turn Finalization**: Live speech captions revise words in real time. CaptionRecorder streams intermediate speech to the UI ticker while tracking author chunk containers in the DOM, deterministically finalizing turns without stutter or duplicate sentences.
- 💾 **Unsaved Session & Reload Recovery**: Unexpected disconnect, call end, or page reload? CaptionRecorder buffers your active call to local storage, guarantees turn flushing on unload, and restores your transcript directly in the Meet overlay and toolbar popup.
- 📁 **Universal Export**: Export your meeting transcripts in seconds to Markdown (.md), Plain Text (.txt), SubRip subtitles (.srt), or WebVTT (.vtt), or copy to clipboard.
- 🌐 **Natively Multilingual**: Automatically matches your browser's language (English, Spanish, Portuguese, Italian, German, French, Russian, Japanese, Korean, Simplified Chinese).


## Permissions Justification

| Permission | Scope | Plain-English Justification |
| :--- | :--- | :--- |
| `storage` | Browser Local Storage | Used to mirror the active meeting transcript locally to prevent data loss in case of accidental tab close or page reload, enabling unsaved meeting recovery in the overlay and extension popup. |
| `host_permissions: https://meet.google.com/*` | Google Meet Web Calls | Required to inject the floating caption recorder overlay into Google Meet tabs and observe closed caption DOM mutations during live meetings. |


## Privacy & Data Use Disclosures

- **Does this extension collect user data?** No.
- **Does this extension transmit user data to any remote server?** No. All captions, transcripts, and storage run strictly on-device using local browser memory.
- **Single Purpose**: Caption recording and transcript exporting.


## Version History

- **v1.1.0 (2026-09-03)**: Accurate subtitle timing via speech start tracking, Unicode meeting export support, CJK word counting with Intl.Segmenter, localized popup idle state, memory leak and UI fixes, and pruned bundle.
- **v1.0.0 (2026-09-03)**: Google Meet caption recording, switch-driven turn finalization, TXT/MD/SRT/VTT export, page reload draft persistence in overlay & popup, and 10 native UI languages.
