# Video Downloader — Build Plan (Embed-First)

**Based on:** `video_downloader_platform_specification.md`  
**Priority:** Embedded video detection → preview → quality → download  
**Status legend:** `Missing` · `Partial` · `Done` · `Later (V2)`

---

## 1. Goal

Ship a production-ready web app where a user pastes a **webpage URL**, the system finds **all accessible embedded / page media**, lets them **preview**, pick **quality/format**, then **download** — without needing to understand HLS, DASH, or FFmpeg.

Core path (must be excellent):

```text
Paste webpage URL
  → Analyze (HTML + JS browser worker)
  → Detect embeds + direct + HLS/DASH
  → Result cards (multi-video)
  → Preview
  → Select quality + format
  → Queue download
  → FFmpeg merge/remux if needed
  → Finished file
```

Compliance: only accessible media; no DRM / paywall / auth bypass.

---

## 2. Gap vs previous yt-dlp UI

| Area | Previous | Plan status |
|------|----------|-------------|
| Paste URL | Done | Keep / harden |
| Fetch info (yt-dlp probe) | Partial | Replace with full analyze API |
| Find embeds (HTML scrape) | **Partial** | Upgrade + Playwright |
| JS-rendered embeds | **Missing** | Phase 1 |
| Multi-video cards | **Missing** | Phase 1 |
| Preview before download | **Missing** | Phase 1 (mandatory) |
| Quality chips from variants | **Missing** | Phase 1 |
| Format selector (MP4/WebM/audio) | **Partial** | Phase 1 |
| HLS / DASH detection | **Missing** | Phase 1 |
| A/V merge via FFmpeg | **Partial** (yt-dlp only) | Phase 1 |
| Batch download | **Missing** | Phase 1 |
| Download manager (pause/retry/cancel) | **Missing** | Phase 1 |
| Real job queue (Redis/BullMQ) | **Missing** | Phase 1 |
| Live progress (WS/SSE) | **Partial** (poll only) | Phase 1 |
| SSRF / sandbox security | **Missing** | Phase 1 |
| History / recent URLs | **Missing** | Phase 1 |
| Subtitles | **Missing** | Phase 1 (MVP) |
| Mobile-first SaaS UI | **Partial** | Phase 1 |
| Docker multi-worker | **Missing** | Phase 1 |
| Accounts / cloud / extension | **Missing** | Later (V2) |

---

## 3. Phase plan (build order)

### Phase 0 — Repo foundation
**Status focus:** Missing

- [ ] Create project (`downloader-video/` or new repo)
- [ ] Next.js + TypeScript frontend
- [ ] Node.js (Fastify/Express) + TypeScript API
- [ ] Shared types (`MediaItem`, `Variant`, `AnalyzeJob`, `DownloadJob`)
- [ ] `.env.example`, logging, error envelope
- [ ] Docker Compose skeleton: `frontend`, `api`, `redis`, `mongodb`, workers
- [ ] Health endpoints `/health`, `/ready`

---

### Phase 1 — Analyzer (embed-first) ⭐
**Status focus:** Partial HTML scan → full detection

#### 1A. URL input & analyze API
- [ ] Large URL input, Paste, Analyze, Clear (**Partial** → Done)
- [ ] URL validation + normalization (**Missing**)
- [ ] Loading / error / empty states (**Partial**)
- [ ] Recent URL history (local or DB) (**Missing**)
- [ ] `POST /api/analyze` → job id; `GET /api/analyze/:id` (**Missing**)

#### 1B. HTML embed scan (upgrade existing Partial)
- [ ] Keep / rewrite HTML extractor:
  - [ ] `<iframe>`, `<video>`, `<source>`, `<embed>`
  - [ ] `og:video`, `twitter:player`
  - [ ] JSON-LD `VideoObject`
  - [ ] Common player URL patterns (YouTube, Vimeo, etc.)
- [ ] Normalize embed URLs to canonical watch/player URLs (**Partial**)
- [ ] Deduplicate candidates (**Partial**)

#### 1C. Playwright browser worker (**Missing** — critical for embeds)
- [ ] Open page in sandboxed Chromium
- [ ] Wait for load + allow JS
- [ ] DOM inspect for media elements / players
- [ ] **Network sniff** for media requests
- [ ] Collect `.mp4`, `.webm`, `.m3u8`, `.mpd`, player APIs
- [ ] Timeouts, memory/CPU limits, temp profile, cleanup
- [ ] Navigation restrictions

#### 1D. Stream & metadata detection (**Missing**)
- [ ] Direct media detection
- [ ] HLS (`.m3u8`) variant parsing
- [ ] DASH (`.mpd`) variant parsing
- [ ] Multiple videos on one page
- [ ] Title, duration, thumbnail where accessible
- [ ] Normalize to common `MediaItem` + `variants[]` schema (§7)

#### 1E. Security on analyze (**Missing**)
- [ ] SSRF protection (localhost, private IPs, metadata endpoints)
- [ ] DNS rebinding checks
- [ ] Rate limit analyze
- [ ] Max page time / size

**Phase 1 exit criteria:** Paste article URL with iframe / JS player → returns **multiple** normalized media cards with variants (or clear “none found”).

---

### Phase 2 — Results + Preview (mandatory UX)
**Status focus:** Missing

- [ ] `/results` page with source URL + count
- [ ] Video cards: thumb, title, duration, codecs summary (**Missing**)
- [ ] Multi-select + Select all (**Missing**)
- [ ] Search/filter detected items (**Missing**)
- [ ] **Preview modal/drawer before download** (**Missing** — do not skip)
  - [ ] Play / pause / seek / volume / fullscreen / PiP
  - [ ] Poster, loading, playback error
  - [ ] Preview uses browser-playable stream when possible
- [ ] Quality selector from **detected** variants only (**Missing**)
- [ ] Format selector: MP4, WebM, MKV; audio MP3/M4A/WAV (**Partial**)
- [ ] “Best available” option (**Missing**)
- [ ] Estimated size where calculable (**Missing**)
- [ ] UX rule: **never auto-start download after analyze** (**Missing**)

**Phase 2 exit criteria:** User can preview the correct embed, pick quality/format, then explicitly hit Download.

---

### Phase 3 — Download engine + queue
**Status focus:** Missing (was single-thread poll job)

- [ ] Redis + BullMQ (or equivalent) job queue (**Missing**)
- [ ] Download worker separate from API (**Missing**)
- [ ] Job states: queued, preparing, downloading, processing, merging, completed, failed, cancelled, paused (**Missing**)
- [ ] Progress via WebSocket or SSE (**Partial** poll → real-time)
- [ ] Pause / resume where supported (**Missing**)
- [ ] Cancel, retry, exponential backoff (**Missing**)
- [ ] Batch download queue (**Missing**)
- [ ] yt-dlp (or equivalent) for known host embeds + direct/HLS fetch for others
- [ ] Max download size / concurrency limits (**Missing**)

---

### Phase 4 — FFmpeg processing
**Status focus:** Partial

- [ ] Isolated FFmpeg / processing worker (**Missing**)
- [ ] Merge separate audio + video (**Partial** via yt-dlp → own control)
- [ ] Prefer remux; re-encode only when needed (**Missing** policy)
- [ ] Audio extraction MP3/M4A/WAV (**Partial**)
- [ ] Thumbnail generation (**Missing**)
- [ ] Temp dir per job + cleanup on success/fail/cancel (**Missing**)

---

### Phase 5 — Manager, history, files
**Status focus:** Missing

- [ ] `/downloads` download manager UI (**Missing**)
- [ ] Open file / download again / remove (**Partial** file list only)
- [ ] Filename templates `{index}_{title}_{quality}` + sanitize (**Missing**)
- [ ] Duplicate detection before download (**Missing**)
- [ ] `/history` with filters (**Missing**)
- [ ] Recent URLs on home (**Missing**)
- [ ] Storage usage + cleanup warnings (**Missing** — can be light in MVP)

---

### Phase 6 — Subtitles (MVP)
**Status focus:** Missing

- [ ] Detect accessible subtitle tracks
- [ ] Language list + SRT/VTT download
- [ ] Optional VTT→SRT
- [ ] Optional embed into container
- [ ] Do not invent subtitles

---

### Phase 7 — Responsive UI / product polish
**Status focus:** Partial

- [ ] Mobile-first layouts (320–430px targets) (**Missing** polish)
- [ ] Desktop: nav + multi-column cards + preview panel
- [ ] Tablet: 2-column; Mobile: single column + bottom sheets
- [ ] Skeleton loaders for analyze steps (**Missing**)
- [ ] Empty / error states (human-readable) (**Partial**)
- [ ] Toasts, focus states, a11y basics (**Missing**)
- [ ] Pages: `/`, `/results`, `/downloads`, `/history`, `/settings` (**Missing**)
- [ ] Settings: default quality/format, filename template (**Missing**)

---

### Phase 8 — Production hardening
**Status focus:** Missing

- [ ] Docker production images for all services
- [ ] Worker scaling notes
- [ ] Structured logs + job IDs
- [ ] Metrics: queue depth, fail rate, disk
- [ ] Automatic temp cleanup jobs
- [ ] Docs: run locally, deploy, limits
- [ ] No hardcoded secrets

---

### Phase 9 — V2 (explicitly later)
**Status:** Later

- User accounts, cloud download/storage
- Browser extension, desktop app
- Public API, webhooks, billing
- Advanced trim/crop/compress
- Optional AI naming/summary (not core)

---

## 4. Embed-downloader checklist (single view)

Use this as the “must win” list:

### Detection
- [x] HTML embeds (iframe/video/meta/JSON-LD) — **Done**
- [x] Playwright JS + network capture — **Done** (optional install; HTML fallback)
- [x] Multi-embed on one page — **Done** (result cards)
- [x] Direct MP4/WebM — **Done** as structured results
- [x] HLS + DASH variants — **Partial** (URL detect + yt-dlp probe)
- [x] Known players via yt-dlp after URL normalize — **Done**

### User confirmation path
- [x] Result cards with thumb/title/duration — **Done**
- [x] In-app preview before download — **Done**
- [x] Quality + format pick — **Done**
- [x] Explicit Download button only after that — **Done**

### Download
- [x] Queue + progress + retry/cancel — **Done** (in-memory + SSE; no Redis yet)
- [x] FFmpeg merge/remux/audio — **Partial** (via yt-dlp when FFmpeg present)
- [x] Batch select — **Done**

### Safety
- [x] SSRF + sandbox + rate limits — **Partial** (SSRF done; rate limits light/Missing)
- [x] No DRM bypass — required / honored

---

## 5. Suggested MVP cut (still embed-capable)

If scope must shrink, **do not cut** these:

1. Playwright + HTML analyzer  
2. Multi-video results  
3. Preview before download  
4. Quality/format select  
5. Async download + progress  
6. FFmpeg merge for split A/V  
7. SSRF protection  
8. Mobile-usable results UI  

Can defer to right after MVP:

- Pause/resume  
- Subtitles  
- Full storage dashboard  
- Advanced settings / themes  
- Perfect history filters  

---

## 6. Definition of done (embed path)

Done when:

1. User pastes a webpage with embedded video(s).  
2. App analyzes (HTML + browser worker).  
3. All accessible embeds/direct/HLS/DASH candidates appear as cards.  
4. User previews the correct video.  
5. User picks quality + format.  
6. Download runs in queue with visible progress.  
7. Output file is playable (merge/remux when needed).  
8. Failures are clear + retryable.  
9. Works on small mobile widths without horizontal overflow.  
10. No DRM bypass; SSRF controls in place.

---

## 7. Implementation status (local MVP)

Scaffolded under `downloder-video/`:

| Item | Status |
|------|--------|
| Next.js UI (Home/Results/Downloads/History/Settings) | Done (MVP) |
| Express analyze + download API | Done (MVP) |
| HTML embed scanner | Done |
| Playwright scanner (optional + HTML fallback) | Done (needs `playwright install chromium`) |
| yt-dlp probe + download + SSE progress | Done |
| Preview modal before download | Done |
| Quality/format selection + batch select | Done |
| SSRF checks | Done |
| Duplicate detection | Done (basic) |
| Redis/BullMQ/Mongo multi-worker Docker | Missing (in-memory queue for MVP) |
| Pause/resume | Missing |
| Subtitles | Missing |
| Full production observability | Missing |

## 8. Owner notes

- **Assignee:** _TBD_  
- **Repo:** `downloder-video/`  
- **Sample pages for QA (embeds):** _TBD_  
- **Deadline:** _TBD_  
