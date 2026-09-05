# CaptionRecorder 🎙️

<img src="assets/preicon.png" alt="CaptionRecorder" width="160" />

A lightweight, minimalistic, and privacy-focused browser extension (Manifest V3) built with
[WXT](https://wxt.dev/) and TypeScript. CaptionRecorder records live closed captions from video
meetings with real-time speaker turn tracking, and exports clean transcripts to TXT, Markdown,
SubRip (SRT), and WebVTT formats.

**Minimalist by design:** Zero runtime dependencies, zero external UI frameworks, zero cloud
telemetry, and zero meeting screen clutter. 100% private, on-device processing.

## 🪶 Minimalist by Design

CaptionRecorder is intentionally engineered to stay out of your way, keep your browser fast, and
respect your resources:

- **Zero Runtime Dependencies**: Exactly `0` npm runtime packages (`dependencies: {}`). Pure vanilla
  TypeScript leveraging native browser capabilities.
- **Zero Framework Bloat**: No heavy UI frameworks (React, Vue, Svelte) or bulky CSS libraries.
  Native HTML/CSS and direct browser DOM APIs ensure instant loading and a featherweight bundle
  size.
- **Zero Screen Clutter**: Zero floating widgets, overlay buttons, or injected watermarks
  obstructing your Google Meet tiles. Recording state is conveyed via a subtle native browser
  toolbar badge (`REC`).
- **Zero Network Calls & Telemetry**: 100% on-device execution. No tracking scripts, third-party
  analytics, remote fonts, or background requests.
- **Lean Memory Footprint**: Streamlined state machine that automatically cleans up resources to
  keep memory usage minimal, even during long, multi-hour calls.

## ✨ Features

- **🪶 Minimalist & Featherweight**: Zero runtime dependencies, zero UI bloat, tiny bundle size, and
  lightning-fast execution with negligible memory usage.
- **🛡️ 100% Privacy-First**: All caption capture, processing, and storage happen locally on your
  machine. Zero cloud services, zero external API keys.
- **⚡ Switch-Driven Caption Finalization**: Live speech captions revise words in real time.
  CaptionRecorder streams intermediate speech to the Side Panel while tracking author chunk
  containers in the DOM, deterministically finalizing turns when speakers pause, switch chunks, or
  change without stutter or duplicate sentences.
- **🧩 Multi-Platform Adapter Architecture**: Decoupled `PlatformAdapter` interface.
  - **Google Meet** (`meet.google.com`) active now.
  - **Zoom Web** (`app.zoom.us/wc/*`) & **Microsoft Teams Web** (`teams.microsoft.com/*`) scheduled
    next.
- **🔴 Non-Intrusive Toolbar Badge**: Zero DOM injection or screen clutter in Google Meet. A native
  browser toolbar badge lights up with `REC` to confirm active recording.
- **📑 Full-Height Side Panel UI**: 1-click opening of a dedicated sidebar to follow live
  transcripts, inspect speaker turns and duration metrics, and export cleanly.
- **🌐 Native Multi-Language UI**: Automatically adapts to your browser's language with zero
  configuration. Supports **English (en)**, **Spanish (es)**, **Portuguese (pt)**, **Italian (it)**,
  **German (de)**, **French (fr)**, **Russian (ru)**, **Japanese (ja)**, **Korean (ko)**, and
  **Simplified Chinese (zh)**.
- **💾 Crash & Tab Close Recovery**: Continuously mirrors live meeting state to local browser
  storage. If a tab is closed unexpectedly, the extension Side Panel allows 1-click recovery and
  export.
- **📁 Multi-Format Export**: Export to formatted **Markdown (.md)**, **Plain Text (.txt)**,
  **SubRip (.srt)**, or **WebVTT (.vtt)** with 1-click clipboard copy.
- **🌐 Cross-Browser Ready**: Built with WXT to target **Google Chrome**, **Mozilla Firefox**, and
  **Apple Safari**.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/caption-recorder.git
cd caption-recorder

# Install dependencies
npm install
```

## 🛠️ Development & Building

### Running in Development (Hot Reload)

```bash
# Start watch & live-reload server (no automated browser spawned)
npm run dev

# Firefox
npm run dev:firefox
```

#### Testing in your regular Chrome browser

When testing Google Meet, automated browser sessions can be blocked by Google's security checks
("Couldn't sign you in - This browser or app may not be secure"). CaptionRecorder's configuration
disables the automated runner by default so you can use your regular signed-in Chrome account:

1. Run `npm run dev` in your terminal.
2. Open your everyday Google Chrome browser.
3. Navigate to `chrome://extensions`.
4. Enable **Developer mode** (switch in top right corner).
5. Click **Load unpacked** and select the `.output/chrome-mv3` directory.
6. WXT's client will automatically live-reload your extension whenever code changes are saved.

### Production Builds

```bash
# Build for Chrome (MV3 -> .output/chrome-mv3)
npm run build

# Build for Firefox (MV3 -> .output/firefox-mv3)
npm run build:firefox

# Build for Safari (MV3 -> .output/safari-mv3)
npm run build:safari
```

### Packaging Distribution Zips

```bash
npm run zip
npm run zip:firefox
```

## 🧪 Testing & Code Quality

```bash
# Run automated tests (Vitest)
npm run test

# Type check
npm run compile

# Lint code (ESLint)
npm run lint

# Format code (Prettier)
npm run format
```

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
