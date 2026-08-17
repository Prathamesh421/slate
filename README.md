# Slate

A real-time collaborative whiteboard. Multiple users draw on the same board in the same room: live cursors, per-user undo, chat, images, emote reactions, and synthesized sounds.

## Demo

Link: https://drive.google.com/file/d/1mfTGUDRS40QfBXHBbEW4tWIQKuJxoAFI/view?usp=drive_link

## Stack

- Next.js 16 (App Router) + React 19 + Express 5 + Socket.IO on a single Node process
- TypeScript (strict), Tailwind CSS v4, Jotai, motion, lucide-react
- Web Audio API for sounds (zero asset files), in-memory rooms (no database)

## Features

- Freehand pen, rectangle, ellipse, eraser, pan; Shift constrains shapes
- Line and fill colors, 1-20px stroke width
- Paste or pick images (auto-resized, draggable placement)
- Region select with a contextual move / copy / delete bar
- Per-user undo and redo (Ctrl+Z / Ctrl+Y), works under concurrency
- Live cursors, user list with move counts, chat
- Emote reactions, sound toggle, share link, download board as PNG

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm run dev
```

Open http://localhost:3000

Create or join a room by its 5-character ID. Open the link in two windows to see the realtime features.

## Production

```bash
npm run build
npm start
```

The server reads the port from the `PORT` environment variable (default 3000). No other configuration or external services are required.

## Notes

- Rooms live in the process memory and are gone when the server restarts; chat is not persisted.
- Rooms are capped at 12 users.