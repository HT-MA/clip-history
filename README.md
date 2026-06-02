# ClipHistory

A lightweight Electron desktop tool that automatically monitors clipboard changes, saves history, and lets you search, star, and paste -- all from a sleek floating window.

![](https://img.shields.io/badge/platform-Windows-blue)
![](https://img.shields.io/badge/electron-33%2B-47848f)

## Features

- **Auto-capture** -- Monitors clipboard every second, saves text and images
- **Instant search** -- Client-side filtering, zero latency
- **Star favorites** -- Toggle stars, filter with `!` prefix
- **Image support** -- Screenshots and copied images appear as thumbnails
- **One-click paste** -- Paste directly into the active window
- **Right-click menu** -- Copy, paste, star, delete per item
- **Export / Import** -- Backup and restore history as JSON
- **System tray** -- Background monitoring with pause, clear, and quick-toggle
- **Global shortcut** -- `Ctrl+Shift+V` to show/hide
- **Resizable window** -- Drag borders to resize
- **7-day auto-cleanup** -- Old items automatically pruned

## Install

```bash
git clone https://github.com/HT-MA/clip-history.git
cd clip-history
npm install
npm start
```

## Build

```bash
npm run build
# Output: dist/ClipHistory.exe (portable)
```

## Tech Stack

- Electron 33
- electron-store (JSON persistence)
- Vanilla HTML/CSS/JS -- no framework overhead

## Project Structure

```
clip-history/
├── main.js           # Electron main process
├── preload.js        # Context bridge
├── renderer/
│   ├── index.html    # UI markup
│   ├── app.js        # Renderer logic
│   └── style.css     # Styles
├── package.json
└── .gitignore
```

## License

MIT