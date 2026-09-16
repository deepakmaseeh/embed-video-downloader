# Embed Video Downloader Platform

Production-oriented web app to **analyze a webpage**, detect **embedded / accessible media**, **preview**, choose quality/format, and **download**.

See also:
- `DEPLOY.md` — GitHub → Render (API) + Vercel (UI)
- `video_downloader_platform_specification.md`
- `BUILD_PLAN.md`

## Stack

- **Web:** Next.js 15 + Tailwind (`apps/web`)
- **API:** Express + TypeScript (`apps/api`)
- **Detection:** HTML embed scan + Playwright (optional) + yt-dlp probe
- **Download:** yt-dlp (+ FFmpeg when installed for merge/audio)

## Prerequisites

- Node.js 20+
- Python 3.12 with `yt-dlp` (`py -3.12 -m pip install yt-dlp`)
- Optional: FFmpeg on PATH (MP3 / merge)
- Optional: `npx playwright install chromium` for JS-rendered pages

## Setup

```powershell
cd downloder-video\apps\api
npm install --ignore-scripts
# optional browser worker:
npx playwright install chromium

cd ..\web
npm install
```

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8788
```

## Run

Terminal 1 — API:

```powershell
cd downloder-video\apps\api
npm run dev
```

Terminal 2 — Web:

```powershell
cd downloder-video\apps\web
npm run dev
```

Open http://localhost:3000

## Core flow

1. Paste webpage URL → **Analyze**
2. HTML + Playwright (if available) find embeds / HLS / DASH / direct media
3. Results cards → **Preview** → quality + format → **Download**
4. Download manager shows live progress (SSE)
5. Finished files are copied to `apps/api/downloads/completed/` while other jobs keep downloading (concurrent queue)
6. Optional browser Save As on each completion (Downloads page / Settings)

## Notes

- SSRF protection blocks private/localhost targets
- If Playwright Chromium is missing, analyzer falls back to HTML-only scan
- **BiblicalTraining.org** uses a site-specific path: `curl` → `__NEXT_DATA__` → JSON:API → Vimeo HLS (same approach as Aditya0320/Video-Downloader)
- DRM / paywalled media is not bypassed
- Cancel only stops that job — other active downloads continue
