# CaptionRecorder 🎙️

A modern, privacy-focused browser extension (Manifest V3) built with [WXT](https://wxt.dev/) and TypeScript. CaptionRecorder records live closed captions from video meetings, eliminates speech recognition stutter via real-time stream reconciliation, generates instant on-device AI meeting summaries using Chrome's built-in Gemini Nano (`window.ai`), and exports to TXT, Markdown, SubRip (SRT), and WebVTT formats.

Zero external framework dependencies. 100% private, on-device processing.


## ✨ Features

- **🛡️ 100% Privacy-First**: All caption capture, processing, storage, and AI summarization happen locally on your machine. Zero cloud services, zero external API keys.
- **⚡ Stream Reconciliation Engine**: Live closed captions revise speech in real time. CaptionRecorder uses sliding suffix-prefix overlap deduplication to absorb interim word revisions without stutter or duplicated sentences.
- **🧩 Multi-Platform Adapter Architecture**: Decoupled `PlatformAdapter` interface.
  - **Google Meet** (`meet.google.com`) active now.
  - **Zoom Web** (`app.zoom.us/wc/*`) & **Microsoft Teams Web** (`teams.microsoft.com/*`) scheduled next.
- **🧠 On-Device Gemini Nano AI**: Uses Chrome's built-in Prompt API (`ai.languageModel` / `window.ai`) to generate structured Executive Summaries, Key Discussion Points, and Action Items. Employs smart hierarchical chunking for long meetings.
- **🌐 Native Multi-Language UI**: Automatically adapts to your browser's language with zero configuration. Supports **English (en)**, **German (de)**, **French (fr)**, **Russian (ru)**, **Japanese (ja)**, **Korean (ko)**, and **Simplified Chinese (zh)**.
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


## 🧠 Enabling Chrome Built-in AI (Gemini Nano)

On-device Gemini Nano is built into modern Chrome versions. To verify or enable it:

1. In Chrome, navigate to `chrome://flags/#optimization-guide-on-device-model` and set it to **Enabled BypassPerfRequirement**.
2. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**.
3. Relaunch Chrome.
4. Navigate to `chrome://components` and ensure **Optimization Guide On Device Model** is downloaded and up to date.

*(On Firefox and Safari, CaptionRecorder detects the absence of `window.ai` and keeps all recording and export capabilities 100% operational).*


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
│   │   ├── StreamReconciler.ts    # Suffix-prefix deduplication algorithm
│   │   └── exporters.ts           # TXT, Markdown, SRT, WebVTT exporters
│   ├── i18n/                      # Native multi-language engine
│   │   ├── types.ts
│   │   ├── locales/               # en, de, fr, ru, ja, ko, zh
│   │   └── index.ts               # Auto-detection & typed translation lookup
│   ├── services/
│   │   ├── GeminiNanoService.ts   # Chrome Prompt API & hierarchical chunking
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
│   ├── StreamReconciler.test.ts
│   ├── exporters.test.ts
│   └── i18n.test.ts
├── wxt.config.ts                  # WXT configuration
├── eslint.config.js               # ESLint 9 configuration
└── package.json
```


## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
