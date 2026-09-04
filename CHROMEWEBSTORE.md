# Chrome Web Store Listing: CaptionRecorder

**Last Updated**: 2026-09-03  
**Version**: 1.1.0  
**Target Browser**: Chrome (Manifest V3), Firefox (Manifest V3), Safari

## Listing Metadata

- **Extension Name**: CaptionRecorder — Live Captions & Transcripts
- **Short Description**: Minimalist, private live caption recorder for Google Meet. Instant speaker
  turn tracking and clean exports to TXT, MD, SRT, & VTT.
- **Category**: Productivity / Accessibility
- **Default Language**: English (UI natively supports EN, ES, PT, IT, DE, FR, RU, JA, KO, ZH)

## Detailed Description

CaptionRecorder is a lightweight, minimalistic, and 100% private on-device Chrome extension that
records live closed captions during your Google Meet calls, tracks real-time speaker turns with
instant finalization, and exports clean transcripts to Markdown, TXT, SRT, or WebVTT.

### Key Highlights

- 🪶 **Minimalist & Featherweight**: Zero bloated frameworks, zero external runtime dependencies,
  and an ultra-lean memory footprint. Pure vanilla TypeScript leveraging native web APIs for instant
  startup without draining system battery or CPU.
- 🧘 **Clutter-Free & Non-Intrusive**: No floating buttons, overlays, watermarks, or distracting
  injected UI over your video call. A subtle browser toolbar badge indicates when captions are
  actively recording.
- 🔒 **Zero Data Collection**: No servers, no telemetry, no third-party APIs, no API keys needed.
  All processing and caption recording run 100% locally on your device.
- ⚡ **Switch-Driven Turn Finalization**: Live speech captions revise words in real time.
  CaptionRecorder streams intermediate speech to the Side Panel while tracking author chunk
  containers in the DOM, deterministically finalizing turns without stutter or duplicate sentences.
- 📑 **Dedicated Side Panel**: 1-click access to your full transcript, live metrics, and exports
  alongside your meeting.
- 💾 **Unsaved Session & Reload Recovery**: Unexpected disconnect, call end, or page reload?
  CaptionRecorder buffers your active call to local storage, guarantees turn flushing on unload, and
  restores your transcript directly in the Side Panel.
- 📁 **Universal Export**: Export your meeting transcripts in seconds to Markdown (.md), Plain Text
  (.txt), SubRip subtitles (.srt), or WebVTT (.vtt), or copy to clipboard.
- 🌐 **Natively Multilingual**: Automatically matches your browser's language (English, Spanish,
  Portuguese, Italian, German, French, Russian, Japanese, Korean, Simplified Chinese).

## Permissions Justification

| Permission                                    | Scope                 | Plain-English Justification                                                                                                                                                    |
| :-------------------------------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                     | Browser Local Storage | Used to mirror the active meeting transcript locally to prevent data loss in case of accidental tab close or page reload, enabling unsaved meeting recovery in the Side Panel. |
| `sidePanel`                                   | Browser Side Panel    | Required to display the transcript reader, live turn metrics, and export controls in a native browser sidebar without obscuring the video call.                                |
| `tabs`                                        | Browser Tabs          | Required to connect the Side Panel to the active Google Meet tab to stream live speech captions and sync recording status.                                                     |
| `host_permissions: https://meet.google.com/*` | Google Meet Web Calls | Required to observe closed caption DOM mutations in Google Meet tabs during live meetings.                                                                                     |

## Privacy & Data Use Disclosures

- **Does this extension collect user data?** No.
- **Does this extension transmit user data to any remote server?** No. All captions, transcripts,
  and storage run strictly on-device using local browser memory.
- **Single Purpose**: Caption recording and transcript exporting.

## Version History

- **v1.1.0 (2026-09-03)**: Accurate subtitle timing via speech start tracking, Unicode meeting
  export support, CJK word counting with Intl.Segmenter, localized popup idle state, memory leak and
  UI fixes, and pruned bundle.
- **v1.0.0 (2026-09-03)**: Google Meet caption recording, switch-driven turn finalization,
  TXT/MD/SRT/VTT export, page reload draft persistence in overlay & popup, and 10 native UI
  languages.
