# Chrome Web Store Listing: CaptionRecorder

**Last Updated**: 2026-09-02  
**Version**: 1.0.0  
**Target Browser**: Chrome (Manifest V3), Firefox (Manifest V3), Safari  


## Listing Metadata

- **Extension Name**: CaptionRecorder — AI Meeting Notes & Live Captions
- **Short Description**: Record live captions from Google Meet, export to TXT, Markdown, SRT, and generate on-device AI summaries with Gemini Nano.
- **Category**: Productivity / Accessibility
- **Default Language**: English (UI natively supports EN, DE, FR, RU, JA, KO, ZH)


## Detailed Description

CaptionRecorder is a 100% private, on-device Chrome extension that records live closed captions during your Google Meet calls, reconciles real-time streaming speech revisions, and generates instant meeting summaries with actionable next steps using Chrome's built-in Gemini Nano AI.

### Key Highlights
- 🔒 **Zero Data Collection**: No servers, no telemetry, no third-party APIs, no API keys needed. All processing and local AI summarization run 100% on your device.
- ⚡ **Stream Deduplication**: Live speech captions frequently revise earlier words as sentences finish. CaptionRecorder's stream reconciliation algorithm automatically eliminates stutter, duplicate words, and repeats.
- 🧠 **On-Device AI Summaries**: Uses Chrome's built-in Gemini Nano (`window.ai`) to generate structured executive summaries, key discussion highlights, and action items with assignees.
- 💾 **Unsaved Session & Reload Recovery**: Unexpected disconnect, call end, or page reload? CaptionRecorder buffers your active call to local storage, guarantees turn flushing on unload, and restores your transcript and AI summary directly in the Meet overlay and toolbar popup.
- 📁 **Universal Export**: Export your meeting notes in seconds to Markdown (.md), Plain Text (.txt), SubRip subtitles (.srt), or WebVTT (.vtt), or copy to clipboard.
- 🌐 **Natively Multilingual**: Automatically matches your browser's language (English, German, French, Russian, Japanese, Korean, Simplified Chinese).


## Permissions Justification

| Permission | Scope | Plain-English Justification |
| :--- | :--- | :--- |
| `storage` | Browser Local Storage | Used to mirror the active meeting transcript locally to prevent data loss in case of accidental tab close or page reload, enabling unsaved meeting recovery in the overlay and extension popup. |
| `host_permissions: https://meet.google.com/*` | Google Meet Web Calls | Required to inject the floating caption recorder overlay into Google Meet tabs and observe closed caption DOM mutations during live meetings. |


## Privacy & Data Use Disclosures

- **Does this extension collect user data?** No.
- **Does this extension transmit user data to any remote server?** No. All captions, transcripts, and AI summarization run strictly on-device using Chrome's built-in APIs and local browser memory.
- **Single Purpose**: Caption recording, transcript exporting, and on-device meeting summarization.


## Version History

- **v1.0.0 (2026-09-02)**: Initial release with Google Meet caption recording, stream reconciliation engine, Gemini Nano on-device AI summarization, TXT/MD/SRT/VTT export, page reload draft persistence in overlay & popup, and 7 native UI languages.
