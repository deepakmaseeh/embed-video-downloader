# Video Downloader Platform — Complete Product, Technical & UI Specification

## 1. Purpose

Build a responsive, production-ready web application that allows a user to paste a webpage URL, analyze that page, detect media that is accessible to the user, preview the detected videos, choose an available quality/format, and download selected media.

The product is a **media detection + download platform**, not merely a direct MP4 downloader.

Core flow:

```text
Paste URL
   ↓
Analyze Page
   ↓
Detect accessible media
   ↓
Show video cards + previews
   ↓
Show available qualities/formats
   ↓
User selects media
   ↓
Download / queue
   ↓
Process with FFmpeg when required
   ↓
Finished file
```

The application must be responsive and attractive on desktop, tablet, and especially small mobile devices.

> Compliance requirement: only download media that the user is authorized to access and that is technically accessible. Do not bypass DRM, authentication controls, paywalls, or other access restrictions.

---

# 2. Product Goals

## Primary goals

1. Paste a webpage URL.
2. Analyze the webpage.
3. Detect all accessible video/media resources associated with that page.
4. Detect multiple videos on the same page.
5. Detect direct media URLs where accessible.
6. Detect HLS streams (`.m3u8`).
7. Detect DASH streams (`.mpd`).
8. Detect available resolutions and variants.
9. Let the user preview a video before downloading.
10. Let the user select quality and format.
11. Download selected videos.
12. Merge separate audio/video streams when necessary.
13. Provide download progress and queue management.
14. Provide batch downloading.
15. Keep the UI simple for beginners but powerful for advanced users.

---

# 3. Target User Experience

The experience should feel like a modern professional media utility.

### Main flow

```text
HOME
  ↓
Paste URL
  ↓
Analyze
  ↓
Scanning / Detection
  ↓
Results
  ↓
Preview selected video
  ↓
Choose quality + format
  ↓
Download
  ↓
Download Manager
  ↓
Completed
```

The user should never need to understand HLS, DASH, codecs, FFmpeg, manifests, or stream merging unless they open an advanced-information section.

---

# 4. Core Features

## 4.1 URL Input

Home page must have:

- Large URL input
- Paste button
- Analyze button
- URL validation
- Clear button
- Recent URL history
- Loading state
- Error state
- Mobile-friendly input

Example:

```text
┌─────────────────────────────────────────────┐
│ 🔗 Paste webpage URL                        │
│                                             │
│ https://example.com/videos                  │
│                                             │
│                         [ Analyze ]         │
└─────────────────────────────────────────────┘
```

Support:

- HTTPS URLs
- HTTP URLs where permitted by deployment/security policy
- URL normalization
- Invalid URL detection

---

# 5. Media Detection Engine

The backend must analyze the supplied webpage in an isolated worker environment.

Detection should support accessible media such as:

### Direct media

- MP4
- WebM
- Other supported browser media formats

### Streaming manifests

- HLS / `.m3u8`
- MPEG-DASH / `.mpd`

### HTML media

Detect:

- `<video>`
- `<source>`
- video player configuration
- accessible media resource URLs

### Embedded players

Detect media exposed by accessible embedded players where technically possible.

The system must not attempt to defeat DRM or protected access.

---

# 6. Browser Extraction

Use a controlled browser worker for pages that require JavaScript rendering.

Recommended:

- Playwright
- Chromium

Responsibilities:

1. Open URL in sandboxed browser.
2. Wait for page load.
3. Allow required page JavaScript to execute.
4. Observe network/media requests.
5. Inspect DOM.
6. Inspect HTML5 media elements.
7. Collect accessible media URLs.
8. Detect manifests.
9. Collect metadata.
10. Return normalized media candidates.

The browser worker must have:

- Timeout
- Memory limit
- CPU limit
- Navigation restrictions
- SSRF protection
- Private IP blocking
- Temporary profile
- Automatic cleanup

---

# 7. Media Normalization

All detected media should be converted into a common internal representation.

Example:

```json
{
  "id": "media_001",
  "title": "Example Video",
  "sourcePage": "https://example.com/page",
  "thumbnail": "...",
  "duration": 762,
  "type": "video",
  "streamType": "hls",
  "variants": [
    {
      "quality": "1080p",
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "bitrate": 4800000,
      "videoCodec": "h264",
      "audioCodec": "aac"
    },
    {
      "quality": "720p",
      "width": 1280,
      "height": 720,
      "fps": 30,
      "bitrate": 2500000
    }
  ]
}
```

Do not expose internal stream URLs unnecessarily in the UI.

---

# 8. Quality Detection

Display only qualities actually detected.

Possible values:

- 2160p / 4K
- 1440p / 2K
- 1080p / Full HD
- 720p / HD
- 480p
- 360p
- 240p
- 144p

Also display:

- Resolution
- FPS
- Bitrate
- Codec where useful
- Estimated size where calculable

Special option:

### Best Available

Automatically choose the highest suitable accessible video + audio combination.

---

# 9. Format Selection

Supported output formats should be based on the source and processing capabilities.

### Video

- MP4
- WebM
- MKV

### Audio

- MP3
- M4A
- WAV

Do not unnecessarily re-encode if a safe remux is possible.

---

# 10. Video + Audio Handling

Some adaptive streaming sources expose video and audio separately.

Architecture:

```text
Video Stream
     │
     ├──────────────┐
     │              │
     ▼              ▼
Video Download   Audio Download
     │              │
     └──────┬───────┘
            ▼
          FFmpeg
            │
            ▼
        Final MP4
```

Prefer:

1. Download compatible streams.
2. Remux when possible.
3. Re-encode only when required by requested output.
4. Preserve quality whenever possible.

---

# 11. Preview Before Downloading

This is a mandatory core feature.

Every detected video should have a **Preview** action.

Preview UI:

```text
┌─────────────────────────────────────┐
│                                     │
│            VIDEO PLAYER              │
│                                     │
│ ▶                             ⚙     │
│                                     │
└─────────────────────────────────────┘

Video Title
42:31 · 1920×1080

Available:
[1080p] [720p] [480p]
```

Preview must support:

- Play
- Pause
- Seek
- Volume
- Fullscreen
- Picture-in-picture where supported
- Poster/thumbnail
- Loading state
- Playback error state

For manifest-based sources, preview using the browser-compatible stream when possible.

The preview should happen **before the download confirmation**, so the user can verify they selected the correct video.

---

# 12. Result Cards

Each detected video should be displayed as a polished card.

Example:

```text
┌─────────────────────────────────────────┐
│ [ VIDEO THUMBNAIL ]                     │
│ ▶ 42:31                                 │
├─────────────────────────────────────────┤
│ Word & Witness                          │
│ 1080p · H.264 · AAC                     │
│                                         │
│ [ Preview ]       [ Download ]          │
└─────────────────────────────────────────┘
```

For multiple videos:

```text
Found 12 videos

[☑ Select All]

Video 1
Video 2
Video 3
...
```

---

# 13. Batch Download

Support:

- Select individual videos
- Select all
- Deselect all
- Batch quality
- Batch format
- Batch download
- Queue selected items

Example:

```text
12 videos found

☑ Select All

☑ Video 01
☑ Video 02
☐ Video 03
☑ Video 04

Quality: Best Available ▼
Format: MP4 ▼

[ Download 3 Selected ]
```

---

# 14. Download Manager

Create a dedicated download manager.

Each job should show:

- Thumbnail
- Filename
- Quality
- Format
- Progress
- Download speed
- ETA
- Current state

States:

- Queued
- Preparing
- Downloading
- Processing
- Merging
- Completed
- Failed
- Cancelled
- Paused

Actions:

- Pause
- Resume
- Cancel
- Retry
- Remove
- Open file
- Download again

---

# 15. Queue System

Use a real backend job queue.

Recommended:

- Redis
- BullMQ

Architecture:

```text
Frontend
   ↓
Node API
   ↓
Redis / BullMQ
   ↓
Download Worker
   ↓
FFmpeg Worker
```

This prevents long-running downloads from blocking API requests.

---

# 16. Download Progress

Use WebSockets or Server-Sent Events for real-time status.

Recommended:

- Socket.IO or native WebSocket

The frontend should receive:

```json
{
  "jobId": "job_123",
  "status": "downloading",
  "progress": 72,
  "speed": "8.4 MB/s",
  "downloaded": 742000000,
  "total": 1024000000,
  "eta": 34
}
```

---

# 17. Retry & Error Handling

Implement:

- Automatic retries
- Exponential backoff
- Network failure recovery
- Partial download handling
- Worker restart recovery
- Job timeout
- Clear error messages

Example user message:

```text
Download could not be completed.

Reason:
The source media became unavailable.

[ Retry ]
```

Do not expose stack traces to normal users.

---

# 18. File Naming

Default:

```text
{index}_{title}.{extension}
```

Examples:

```text
01_Word_and_Witness.mp4
02_What_Is_Faith.mp4
03_The_Gospel.mp4
```

Support templates:

```text
{title}
{index}
{quality}
{format}
{date}
{source}
```

Example:

```text
{index}_{title}_{quality}
```

Result:

```text
01_Word_and_Witness_1080p.mp4
```

Sanitize illegal filesystem characters.

---

# 19. Duplicate Detection

Before downloading:

```text
This video may already exist.

Existing file:
Word_and_Witness_1080p.mp4

[Use Existing]
[Download Again]
[Cancel]
```

Use:

- Filename
- Source URL
- Media identifier
- Hash when appropriate

---

# 20. Subtitle Features

Where subtitles/captions are accessible:

- Detect subtitle tracks
- Show available languages
- Download subtitles
- SRT
- VTT
- Convert VTT → SRT
- Associate subtitle with downloaded video
- Optional subtitle embedding

Example:

```text
Subtitles

☑ English
☐ Hindi

Format: SRT
```

Do not invent subtitles when the source does not expose them.

---

# 21. Audio Extraction

Allow:

```text
Video → Audio
```

Options:

- MP3
- M4A
- WAV

Show audio bitrate where available.

---

# 22. FFmpeg Processing Layer

FFmpeg is the core media-processing tool.

Responsibilities:

- Merge audio/video
- Remux
- Convert formats
- Extract audio
- Generate thumbnails
- Basic compression
- Subtitle processing
- Basic trimming if implemented

Keep processing isolated from the API server.

---

# 23. Optional Post-Processing

Future features:

- Trim
- Crop
- Resize
- Compress
- Change aspect ratio
- Change FPS
- Extract frame
- Generate thumbnail
- Remove audio
- Add subtitles

These should be separate processing jobs.

---

# 24. Download History

Store:

- Title
- Source page
- Filename
- Quality
- Format
- Date
- Status
- File size

Filters:

- Completed
- Failed
- Cancelled
- Date
- Format

Actions:

- Re-download
- Preview
- Delete history entry

---

# 25. Recent URLs

Home page can show:

```text
Recent URLs

example.com/videos
example.com/course
example.com/lessons
```

Clicking a recent URL can re-analyze it.

---

# 26. Storage Management

Dashboard:

```text
Storage

Used       184 GB
Available  816 GB

Videos     160 GB
Audio       20 GB
Subtitles    2 GB
Temporary   2 GB
```

Features:

- Storage usage
- Temporary file cleanup
- Completed-file cleanup
- Delete files
- Disk-space warnings

---

# 27. Responsive UI Requirements

The UI must be **mobile-first**.

### Desktop

Use:

- Sidebar/navigation
- Multi-column video grid
- Large preview panel
- Download manager panel

### Tablet

Use:

- Collapsible sidebar
- 2-column cards
- Responsive preview

### Mobile

Use:

- Bottom navigation or compact top navigation
- Single-column cards
- Full-width URL input
- Full-width buttons
- Bottom sheets for quality selection
- Mobile-friendly preview
- Touch-friendly controls
- No horizontal scrolling

Minimum design target:

```text
320px width
360px width
390px width
430px width
```

Nothing important should overflow.

---

# 28. UI Design Language

The application should look like a **professional modern SaaS product**, not a basic utility page.

Design characteristics:

- Clean
- Modern
- Premium
- Minimal
- Attractive
- High readability
- Strong visual hierarchy
- Subtle animations
- Rounded cards
- Clear buttons
- Good spacing
- Professional typography

Avoid:

- Excessive gradients
- Excessive glow
- Clutter
- Tiny controls
- Too many colors
- Overloaded dashboards

---

# 29. Recommended Pages

## `/`

Landing / Analyzer

Contains:

- Brand/logo
- URL input
- Analyze button
- Recent URLs
- Feature highlights

## `/results`

Detection results.

Contains:

- Source URL
- Number of detected videos
- Search/filter
- Select all
- Video cards
- Preview
- Quality selection
- Download buttons

## `/downloads`

Download manager.

Contains:

- Active
- Queued
- Completed
- Failed

## `/history`

Download history.

## `/settings`

Settings:

- Default quality
- Default format
- Filename template
- Download behavior
- Storage preferences
- Appearance

---

# 30. Main Navigation

Desktop:

```text
Logo

Home
Downloads
History
Settings

────────────────
Storage
System Status
```

Mobile:

```text
Home    Downloads    History    Settings
```

---

# 31. Preview Modal / Drawer

On desktop:

Use a large centered modal.

On mobile:

Use a full-screen drawer/modal.

Structure:

```text
┌──────────────────────────────────────┐
│ ← Preview                         X  │
│                                      │
│          VIDEO PLAYER                │
│                                      │
│ Title                                │
│ Duration                             │
│                                      │
│ Quality                              │
│ [1080p] [720p] [480p]               │
│                                      │
│ Format                               │
│ [MP4 ▼]                              │
│                                      │
│        [ Download ]                  │
└──────────────────────────────────────┘
```

---

# 32. Loading States

Use polished skeletons instead of blank screens.

Analyzer:

```text
Analyzing webpage...

✓ Page loaded
✓ Scanning media
● Detecting qualities
○ Preparing results
```

Result cards should have skeleton loaders.

---

# 33. Empty States

Example:

```text
No downloadable media found.

The page may contain:
• No accessible video
• Protected media
• Unsupported media format

Try another URL.
```

---

# 34. Error States

Handle:

- Invalid URL
- Page unavailable
- Timeout
- No media
- Unsupported stream
- Media unavailable
- Processing failure
- Storage failure
- Worker failure

Errors must be human-readable.

---

# 35. Accessibility

Implement:

- Keyboard navigation
- Focus states
- Proper labels
- ARIA where required
- Accessible contrast
- Screen-reader-friendly controls
- Large touch targets
- Reduced-motion support

---

# 36. Frontend Technology

Recommended:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Modern component system
- Responsive CSS
- WebSocket/Socket.IO client

Suggested structure:

```text
src/
├── app/
│   ├── page.tsx
│   ├── results/
│   ├── downloads/
│   ├── history/
│   └── settings/
│
├── components/
│   ├── url-input/
│   ├── video-card/
│   ├── video-preview/
│   ├── quality-selector/
│   ├── format-selector/
│   ├── download-manager/
│   ├── progress-bar/
│   └── layout/
│
├── hooks/
├── lib/
├── services/
└── types/
```

---

# 37. Backend Technology

Recommended:

- Node.js
- TypeScript
- Express or Fastify
- MongoDB
- Redis
- BullMQ
- Playwright
- FFmpeg
- Docker

Architecture:

```text
                    ┌─────────────────┐
                    │    Next.js UI   │
                    └────────┬────────┘
                             │
                        HTTPS / WSS
                             │
                    ┌────────▼────────┐
                    │    API Server   │
                    │ Node.js/TS      │
                    └───────┬─────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
          MongoDB         Redis         WebSocket
              │             │
              │          BullMQ
              │             │
              │       ┌─────┴──────┐
              │       ▼            ▼
              │   Browser       Download
              │   Worker        Worker
              │       │            │
              │   Playwright      │
              │       │            │
              │       └─────┬──────┘
              │             ▼
              │          FFmpeg
              │             │
              └─────────────┘
```

---

# 38. API Design

Example endpoints:

```text
POST   /api/analyze
GET    /api/analyze/:id

POST   /api/download
GET    /api/downloads
GET    /api/downloads/:id
POST   /api/downloads/:id/pause
POST   /api/downloads/:id/resume
POST   /api/downloads/:id/retry
DELETE /api/downloads/:id

GET    /api/history
DELETE /api/history/:id

GET    /api/settings
PATCH  /api/settings
```

Keep API responses typed and consistent.

---

# 39. Database

MongoDB collections:

```text
users
analysis_jobs
media_items
download_jobs
download_history
settings
```

### Download Job

```json
{
  "_id": "...",
  "userId": "...",
  "mediaId": "...",
  "quality": "1080p",
  "format": "mp4",
  "status": "downloading",
  "progress": 72,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

# 40. Worker Architecture

Separate workers:

### Analyzer Worker

- Playwright
- DOM extraction
- Network inspection
- Metadata extraction

### Download Worker

- Fetch media
- Segment downloading
- Progress tracking
- Retry

### Processing Worker

- FFmpeg
- Merge
- Remux
- Convert
- Thumbnail
- Subtitle processing

Workers should be independently scalable.

---

# 41. Temporary Storage

Never store temporary files forever.

Use:

```text
/tmp/jobs/{jobId}/
```

or dedicated temporary storage.

After completion:

```text
Temporary files
       ↓
cleanup
```

Implement automatic cleanup on:

- Successful completion
- Failed job
- Cancelled job
- Timeout
- Worker crash recovery

---

# 42. Security Architecture

This is critical because the platform accepts arbitrary URLs.

Implement:

## SSRF protection

Block requests to:

- localhost
- loopback
- private IP ranges
- internal cloud metadata endpoints
- internal network addresses

Validate DNS and resolved IPs.

## Browser sandboxing

Run Playwright workers in isolated containers.

## Resource limits

Set:

- Maximum page-analysis time
- Maximum download size
- Maximum processing time
- CPU limits
- RAM limits
- Concurrent job limits

## File security

Validate generated files and extensions.

## Rate limiting

Limit:

- URL analysis
- Downloads
- API requests
- Concurrent jobs

## Secrets

Use environment variables or a proper secrets manager.

Never commit credentials.

---

# 43. Docker Architecture

Recommended containers:

```text
docker-compose.yml

services:

  frontend
  api
  analyzer-worker
  download-worker
  processing-worker
  redis
  mongodb
```

FFmpeg and Chromium dependencies should be installed in the appropriate worker images.

---

# 44. Observability

Add:

- Structured logging
- Job IDs
- Error tracking
- Worker health
- Queue metrics
- API latency
- Download failure rate
- Processing time
- Disk usage
- CPU/RAM monitoring

Health endpoints:

```text
/health
/ready
```

---

# 45. Configuration

Use environment variables:

```text
NODE_ENV
PORT
MONGODB_URI
REDIS_URL
DOWNLOAD_DIR
TEMP_DIR
MAX_DOWNLOAD_SIZE
MAX_CONCURRENT_JOBS
JOB_TIMEOUT
```

Provide `.env.example`.

Never hardcode secrets.

---

# 46. Performance

Important requirements:

- Do not block API requests with downloads.
- Use queue workers.
- Stream progress.
- Avoid unnecessary transcoding.
- Use remux whenever possible.
- Cache analysis results where appropriate.
- Clean temporary files.
- Limit concurrency according to hardware.
- Prevent duplicate jobs.

---

# 47. Future Features

Build the architecture so these can be added later:

## Browser extension

```text
Browser
  ↓
Extension
  ↓
Send page URL
  ↓
Downloader
```

## Desktop application

- Windows
- macOS
- Linux

## Cloud download

```text
URL
 ↓
Cloud worker
 ↓
Object storage
 ↓
User download
```

## Cloud storage

- S3
- Google Cloud Storage
- Google Drive
- Dropbox
- OneDrive

## Public API

Allow other applications to submit jobs.

## Webhooks

Notify external systems when jobs finish.

## User accounts

- Login
- Profiles
- Preferences
- Usage

## SaaS billing

- Free
- Pro
- Enterprise

---

# 48. AI Features — Optional Future Layer

Do not make AI a dependency for the core downloader.

Possible later additions:

### AI title generation

Turn:

```text
VID_839201.mp4
```

into a meaningful filename based on accessible metadata/content.

### AI categorization

Classify detected media.

### AI summary

Generate a summary after downloading.

### AI chapters

Detect chapter timestamps.

### AI subtitle generation

Where legally/technically appropriate and where the user has rights to process the media.

---

# 49. MVP Scope

Build V1 with:

- Responsive Next.js frontend
- URL analyzer
- Playwright browser worker
- Direct media detection
- HLS detection
- DASH detection
- Multiple-video detection
- Metadata detection
- Quality detection
- Video preview
- Quality selector
- Format selector
- MP4 output
- WebM output where appropriate
- Audio extraction
- FFmpeg
- Audio/video merging
- Download queue
- Progress
- Pause/resume
- Retry
- Cancel
- Batch download
- File naming
- Duplicate detection
- Download history
- Subtitle detection
- Mobile responsive UI
- Docker deployment
- Security controls

---

# 50. V2 Scope

After V1 is stable:

- User accounts
- Persistent storage
- Cloud download
- Browser extension
- Advanced video processing
- Cloud storage integrations
- API
- Webhooks
- Advanced analytics
- SaaS billing
- Desktop application

---

# 51. UI Quality Requirements

The UI is not an afterthought.

Cursor should implement:

- Fully responsive layouts
- Mobile-first behavior
- Attractive modern cards
- Smooth but subtle animations
- Skeleton loaders
- Empty states
- Error states
- Toast notifications
- Modal/drawer previews
- Touch-friendly controls
- Dark/light theme support
- Consistent typography
- Consistent spacing
- Clear primary/secondary actions

The most important interaction is:

```text
PASTE URL
    ↓
ANALYZE
    ↓
PREVIEW
    ↓
SELECT QUALITY
    ↓
DOWNLOAD
```

Keep this path extremely clear.

---

# 52. Important UX Rule

**Never start a download immediately after analysis.**

The user must first see:

1. Detected video
2. Thumbnail
3. Title
4. Duration
5. Preview
6. Available quality
7. Format
8. Estimated size where available

Then:

```text
[ Download ]
```

This prevents downloading the wrong media from pages containing advertisements, previews, multiple videos, or unrelated media.

---

# 53. Cursor Implementation Instructions

Cursor should follow this development order:

## Phase 1 — Inspect

Before modifying anything:

- Inspect repository
- Identify existing frontend/backend
- Identify package manager
- Identify Node version
- Identify deployment setup
- Identify existing environment variables
- Do not overwrite existing working functionality unnecessarily.

## Phase 2 — Foundation

Create:

- Frontend
- API
- Shared types
- Environment configuration
- Docker configuration
- Logging
- Error handling

## Phase 3 — Analyzer

Implement:

- URL validation
- SSRF protection
- Playwright worker
- DOM media detection
- Network media detection
- HLS detection
- DASH detection
- Metadata extraction

## Phase 4 — Results

Implement:

- Video cards
- Thumbnail
- Metadata
- Preview
- Quality selector
- Format selector
- Multi-select

## Phase 5 — Download Engine

Implement:

- BullMQ
- Redis
- Download workers
- Progress
- Pause/resume where technically supported
- Retry
- Cancellation
- Queue management

## Phase 6 — FFmpeg

Implement:

- Merge
- Remux
- Format conversion
- Audio extraction
- Thumbnail generation

## Phase 7 — History

Implement:

- Download history
- Recent URLs
- Duplicate detection
- File management

## Phase 8 — Responsive UI

Test at:

```text
320px
360px
390px
430px
768px
1024px
1280px
1440px+
```

## Phase 9 — Security

Test:

- SSRF
- Malicious URLs
- Huge files
- Long-running pages
- Worker crashes
- Disk exhaustion
- Rate limits
- Invalid manifests
- Malformed media

## Phase 10 — Production

Add:

- Health checks
- Logging
- Metrics
- Docker production builds
- Worker scaling
- Cleanup jobs
- Backup strategy
- Documentation

---

# 54. Definition of Done

The project is complete only when:

- User can paste a valid webpage URL.
- The application analyzes it.
- Multiple accessible videos can be detected.
- Results are displayed clearly.
- Each video can be previewed before downloading.
- Available qualities are shown accurately.
- User can select quality.
- User can select format.
- Video/audio streams can be combined when necessary.
- Download progress is visible.
- Jobs run asynchronously.
- Failed downloads can be retried.
- Multiple downloads can be queued.
- Batch downloading works.
- Download history works.
- UI works on small mobile screens.
- No horizontal overflow occurs on mobile.
- Security protections are implemented.
- Temporary files are cleaned.
- API and workers can be independently restarted.
- Docker deployment works.
- Errors are handled gracefully.
- No credentials are hardcoded.
- DRM/protected-access bypass is not implemented.

---

# 55. Final Product Vision

The final application should feel like:

**A modern professional media download manager that starts with a simple webpage URL.**

The user experience should be:

```text
                 ┌──────────────────┐
                 │   PASTE URL      │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │    ANALYZE       │
                 └────────┬─────────┘
                          ↓
              ┌─────────────────────────┐
              │   MEDIA DETECTION       │
              │                         │
              │  🎬 Video 1             │
              │  🎬 Video 2             │
              │  🎬 Video 3             │
              │  🎬 Video 4             │
              └────────────┬────────────┘
                           ↓
                 ┌──────────────────┐
                 │     PREVIEW      │
                 └────────┬─────────┘
                          ↓
             ┌──────────────────────────┐
             │ Quality: 1080p ▼         │
             │ Format: MP4 ▼            │
             │                          │
             │       DOWNLOAD           │
             └────────────┬─────────────┘
                          ↓
                 ┌──────────────────┐
                 │ DOWNLOAD MANAGER │
                 │                  │
                 │ ████████░ 82%    │
                 │ █████░░░░ 51%    │
                 │ queued           │
                 └──────────────────┘
```

The architecture must remain modular so the **analyzer, downloader, FFmpeg processor, queue, and frontend can scale independently**.
