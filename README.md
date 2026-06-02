# ClipHistory

A lightweight Electron desktop tool that automatically monitors clipboard changes, saves history, and lets you search, star, and paste — all from a sleek floating window.

![screenshot](https://img.shields.io/badge/platform-Windows-blue)
![screenshot](https://img.shields.io/badge/electron-33%2B-47848f)

## Features

- **Auto-capture** 鈥?Monitors clipboard every second, saves text and images
- **Instant search** 鈥?Client-side filtering, zero latency
- **Star favorites** 鈥?Toggle stars, filter with `!` prefix
- **Image support** 鈥?Screenshots and copied images appear as thumbnails
- **One-click paste** 鈥?Paste directly into the active window
- **Right-click menu** 鈥?Copy, paste, star, delete per item
- **Export / Import** 鈥?Backup and restore history as JSON
- **System tray** 鈥?Background monitoring with pause, clear, and quick-toggle
- **Global shortcut** 鈥?`Ctrl+Shift+V` to show/hide
- **Resizable window** 鈥?Drag borders to resize
- **7-day auto-cleanup** 鈥?Old items automatically pruned

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
- Vanilla HTML/CSS/JS 鈥?no framework overhead

## Project Structure

```
clip-history/
鈹溾攢鈹€ main.js           # Electron main process
鈹溾攢鈹€ preload.js        # Context bridge
鈹溾攢鈹€ renderer/
鈹?  鈹溾攢鈹€ index.html   # UI markup
鈹?  鈹溾攢鈹€ app.js       # Renderer logic
鈹?  鈹斺攢鈹€ style.css    # Styles
鈹溾攢鈹€ package.json
鈹斺攢鈹€ .gitignore
```

## License

MIT