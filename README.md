# Flipbook

**English** | [日本語](README.ja.md)

Turn still photos into a slideshow video — right in your browser.

Flipbook is a single HTML file. Open it, add your photos, answer seven short questions, and save an MP4 or WebM video. It works offline, and your photos never leave your computer.

> "Flipbook" is a working title.

## Features

- **Seven simple steps**: Photos → Aspect Ratio → Format → Duration → Transition → Black → Export
- **Sensible defaults** on every step, so you can just keep pressing *Next*
- **Aspect ratios**: 16:9, 4:3, 1:1, 9:16 — with *Fit* (whole photo, black bars) or *Fill* (crop to fill)
- **Formats**: MP4 (H.264) or WebM (VP9), full HD (short side 1080 px), 30 fps
- **Transitions**: Cut or Fade, with adjustable fade length
- **Black** lead-in and lead-out
- **Undo / redo** (⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y) for photo and setting changes
- **Preview** before export
- **Choose where to save** (Chrome / Edge)
- **Phones and tablets**: press and hold to reorder photos, save to Photos or share via the share sheet, screen stays on while the video is made
- **Built-in Help** that explains every step in plain language
- **English / Japanese** UI, **light / dark** theme
- **Offline and private**: everything runs locally in the browser

## Using Flipbook

1. Get `flipbook.html` (see [Building](#building) below).
2. Double-click it to open it in **Google Chrome** or **Microsoft Edge**.
3. Follow the steps. If you get stuck, press **Help**.

### Browser support

| Browser | Make videos | Choose where to save |
| --- | --- | --- |
| Chrome / Edge (latest) | ✅ | ✅ |
| Safari 17+ | ✅ | — Saves to Downloads |
| Firefox 130+ | ✅ | — Saves to Downloads |
| iPhone / iPad: Safari (iOS 17+) | ✅ | Share sheet → *Save Video* to Photos |
| Android: Chrome | ✅ | Share sheet, or Downloads |

Flipbook has been tested in Chrome on a computer and in Chrome's phone emulation. Safari, Firefox and real phones should work based on their WebCodecs support, but haven't been tested yet.

Phones can't run an HTML file saved on the device, so on a phone Flipbook needs to be opened from a web address.

The Help screen explains how to make Safari and Firefox ask where to save every download.

HEIC photos (iPhone) open in Safari only; in other browsers, convert them to JPEG first.

## Building

Requires [Node.js](https://nodejs.org/) 20 or later.

```sh
npm install
npm run build      # → dist/flipbook.html (single self-contained file)
```

During development:

```sh
npm run dev        # then open http://localhost:5173/flipbook.html
npm run typecheck
```

## How it works

- Photos are decoded with `createImageBitmap` and drawn onto a canvas, one frame at a time.
- Frames are encoded with the browser's [WebCodecs](https://developer.mozilla.org/docs/Web/API/WebCodecs_API) API and packaged into MP4/WebM with [Mediabunny](https://mediabunny.dev/).
- In Chrome/Edge, the video is streamed straight to the file you picked with the [File System Access API](https://developer.mozilla.org/docs/Web/API/Window/showSaveFilePicker). Other browsers build it in memory and download it.
- [Vite](https://vite.dev/) and [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) inline all JavaScript and CSS into one HTML file, so no network access is needed.

### Project layout

```
flipbook.html      Entry HTML
src/main.ts        UI, steps, preview player, actions
src/timeline.ts    Timeline model and frame drawing (shared by preview and export)
src/exporter.ts    Encoding and saving
src/photos.ts      Loading photos and thumbnails
src/i18n.ts        UI strings (English / Japanese)
src/help.ts        Help content (English / Japanese)
src/history.ts     Undo / redo history
src/reorder.ts     Drag to reorder (mouse, touch, pen)
src/style.css      Styles, light and dark themes
```

## Roadmap

- Background music (one track, faded out at the end)
