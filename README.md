# CaptionRecorder 🎙️

A modern, privacy-focused browser extension (Manifest V3) built with [WXT](https://wxt.dev/) and TypeScript. CaptionRecorder records live closed captions from video meetings with real-time speaker turn tracking, and exports clean transcripts to TXT, Markdown, SubRip (SRT), and WebVTT formats.

Zero external framework dependencies. 100% private, on-device processing.


## ✨ Features

- **🛡️ 100% Privacy-First**: All caption capture, processing, and storage happen locally on your machine. Zero cloud services, zero external API keys.
- **⚡ Switch-Driven Caption Finalization**: Live speech captions revise words in real time. CaptionRecorder streams intermediate speech to the UI ticker while tracking author chunk containers in the DOM, deterministically finalizing turns when speakers pause, switch chunks, or change without stutter or duplicate sentences.
- **🧩 Multi-Platform Adapter Architecture**: Decoupled `PlatformAdapter` interface.
  - **Google Meet** (`meet.google.com`) active now.
  - **Zoom Web** (`app.zoom.us/wc/*`) & **Microsoft Teams Web** (`teams.microsoft.com/*`) scheduled next.
- **🌐 Native Multi-Language UI**: Automatically adapts to your browser's language with zero configuration. Supports **English (en)**, **Spanish (es)**, **Portuguese (pt)**, **Italian (it)**, **German (de)**, **French (fr)**, **Russian (ru)**, **Japanese (ja)**, **Korean (ko)**, and **Simplified Chinese (zh)**.
- **💾 Crash & Tab Close Recovery**: Continuously mirrors live meeting state to local browser storage. If a tab is closed unexpectedly, the extension toolbar popup allows 1-click recovery and export.
- **📁 Multi-Format Export**: Export to formatted **Markdown (.md)**, **Plain Text (.txt)**, **SubRip (.srt)**, or **WebVTT (.vtt)** with 1-click clipboard copy.
- **🌐 Cross-Browser Ready**: Built with WXT to target **Google Chrome**, **Mozilla Firefox**, and **Apple Safari**.


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

When testing Google Meet, automated browser sessions can be blocked by Google's security checks ("Couldn't sign you in - This browser or app may not be secure"). CaptionRecorder's configuration disables the automated runner by default so you can use your regular signed-in Chrome account:

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


## 📂 Project Structure

```
caption-recorder/
├── .github/workflows/ci.yml       # GitHub Actions CI (lint, typecheck, test, build)
├── public/icon/                   # Extension icons (16, 32, 48, 128px)
├── src/
│   ├── adapters/                  # Platform DOM observers
│   │   ├── PlatformAdapter.ts     # Common adapter interface
│   │   ├── GoogleMeetAdapter.ts   # Google Meet DOM selector isolation
│   │   └── index.ts               # Adapter factory
│   ├── core/                      # Core business logic
│   │   ├── types.ts               # Domain types
│   │   └── exporters.ts           # TXT, Markdown, SRT, WebVTT exporters
│   ├── i18n/                      # Native multi-language engine
│   │   ├── types.ts
│   │   ├── locales/               # en, de, fr, ru, ja, ko, zh
│   │   └── index.ts               # Auto-detection & typed translation lookup
│   ├── services/
│   │   └── DraftStorageService.ts # Local storage mirroring & crash recovery
│   ├── ui/                        # Injected Shadow DOM overlay
│   │   ├── CaptionOverlay.ts      # Draggable floating badge & drawer component
│   │   └── styles.css             # Scoped Shadow DOM styles
│   └── entrypoints/
│       ├── background.ts          # MV3 service worker
│       ├── content.ts             # Content script (createShadowRootUi)
│       └── popup/                 # Toolbar popup for unsaved draft recovery
│           ├── index.html
│           ├── main.ts
│           └── style.css
├── tests/                         # Vitest automated tests
│   ├── CaptionOverlayRecovery.test.ts # Page reload draft persistence
│   ├── DraftStorageService.test.ts    # Debounced storage caching
│   ├── GoogleMeetAdapter.test.ts      # Chunk switching & DOM capture
│   ├── exporters.test.ts              # TXT/MD/SRT/VTT formatting
│   └── i18n.test.ts                   # Multilingual dictionary tests
├── wxt.config.ts                  # WXT configuration
├── eslint.config.js               # ESLint 9 configuration
└── package.json
```


## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
