import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { runAnalyze } from "./analyzer";
import { cancelDownload, enqueueDownload, onDownloadUpdate, retryDownload } from "./download/queue";
import { store } from "./store/memory";

const app = express();
const PORT = Number(process.env.PORT || 8788);

const frontendOrigins = (process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: frontendOrigins.length
      ? (origin, cb) => {
          if (!origin || frontendOrigins.includes(origin) || frontendOrigins.includes("*")) {
            cb(null, true);
          } else {
            cb(new Error(`CORS blocked for origin: ${origin}`));
          }
        }
      : true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "downloader-api" });
});

app.get("/ready", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/analyze", async (req, res) => {
  const parsed = z.object({ url: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "URL required" });
  try {
    const job = await runAnalyze(parsed.data.url);
    res.status(202).json(job);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/analyze/:id", (req, res) => {
  const job = store.getAnalyze(req.params.id);
  if (!job) return res.status(404).json({ error: "Analyze job not found" });
  res.json(job);
});

app.post("/api/download", (req, res) => {
  const schema = z.object({
    mediaId: z.string(),
    title: z.string(),
    sourcePage: z.string(),
    mediaUrl: z.string(),
    quality: z.string().default("Best Available"),
    format: z.string().default("mp4"),
    formatId: z.string().optional(),
    thumbnail: z.string().optional(),
    lessonId: z.string().optional(),
    includeTranscript: z.boolean().optional(),
    transcriptOnly: z.boolean().optional(),
    courseTitle: z.string().optional(),
    instructor: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid download request" });

  if (!parsed.data.transcriptOnly) {
    const existing = store.listDownloads().find(
      (d) =>
        d.status === "completed" &&
        d.title === parsed.data.title &&
        d.quality === parsed.data.quality &&
        d.format === parsed.data.format &&
        d.filename
    );
    if (existing) {
      return res.status(409).json({
        error: "This video may already exist",
        existing,
      });
    }
  }

  const job = enqueueDownload(parsed.data);
  res.status(202).json(job);
});

app.post("/api/download/force", (req, res) => {
  const schema = z.object({
    mediaId: z.string(),
    title: z.string(),
    sourcePage: z.string(),
    mediaUrl: z.string(),
    quality: z.string().default("Best Available"),
    format: z.string().default("mp4"),
    formatId: z.string().optional(),
    thumbnail: z.string().optional(),
    lessonId: z.string().optional(),
    includeTranscript: z.boolean().optional(),
    transcriptOnly: z.boolean().optional(),
    courseTitle: z.string().optional(),
    instructor: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid download request" });
  const job = enqueueDownload(parsed.data);
  res.status(202).json(job);
});

app.post("/api/transcript", (req, res) => {
  const schema = z.object({
    mediaId: z.string().default("transcript"),
    title: z.string(),
    sourcePage: z.string(),
    lessonId: z.string(),
    courseTitle: z.string().optional(),
    instructor: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "lessonId and title required" });
  const job = enqueueDownload({
    mediaId: parsed.data.mediaId,
    title: parsed.data.title,
    sourcePage: parsed.data.sourcePage,
    mediaUrl: parsed.data.sourcePage,
    quality: "transcript",
    format: "txt",
    lessonId: parsed.data.lessonId,
    includeTranscript: true,
    transcriptOnly: true,
    courseTitle: parsed.data.courseTitle,
    instructor: parsed.data.instructor,
  });
  res.status(202).json(job);
});

const downloadItemSchema = z.object({
  mediaId: z.string(),
  title: z.string(),
  sourcePage: z.string(),
  mediaUrl: z.string().optional(),
  quality: z.string().default("Best Available"),
  format: z.string().default("mp4"),
  formatId: z.string().optional(),
  thumbnail: z.string().optional(),
  lessonId: z.string().optional(),
  includeTranscript: z.boolean().optional(),
  transcriptOnly: z.boolean().optional(),
  courseTitle: z.string().optional(),
  instructor: z.string().optional(),
});

/** Queue many videos and/or transcripts at once (concurrent pump keeps running). */
app.post("/api/download/batch", (req, res) => {
  const schema = z.object({
    items: z.array(downloadItemSchema).min(1).max(200),
    /** If true, every video job also pulls transcript when lessonId is present */
    includeTranscript: z.boolean().optional(),
    /** If true, enqueue transcript-only jobs for items with lessonId */
    transcriptsOnly: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid batch download request" });

  const jobs = [];
  for (const item of parsed.data.items) {
    if (parsed.data.transcriptsOnly) {
      if (!item.lessonId) continue;
      jobs.push(
        enqueueDownload({
          mediaId: item.mediaId,
          title: item.title,
          sourcePage: item.sourcePage,
          mediaUrl: item.mediaUrl || item.sourcePage,
          quality: "transcript",
          format: "txt",
          lessonId: item.lessonId,
          includeTranscript: true,
          transcriptOnly: true,
          courseTitle: item.courseTitle,
          instructor: item.instructor,
        })
      );
      continue;
    }

    const withTx =
      Boolean(item.includeTranscript) ||
      (Boolean(parsed.data.includeTranscript) && Boolean(item.lessonId));

    jobs.push(
      enqueueDownload({
        mediaId: item.mediaId,
        title: item.title,
        sourcePage: item.sourcePage,
        mediaUrl: item.mediaUrl || item.sourcePage,
        quality: item.quality,
        format: item.format,
        formatId: item.formatId,
        thumbnail: item.thumbnail,
        lessonId: item.lessonId,
        includeTranscript: withTx,
        transcriptOnly: false,
        courseTitle: item.courseTitle,
        instructor: item.instructor,
      })
    );
  }

  res.status(202).json({ queued: jobs.length, jobs });
});

app.get("/api/downloads", (_req, res) => {
  res.json({ downloads: store.listDownloads() });
});

app.get("/api/downloads/:id", (req, res) => {
  const job = store.getDownload(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.post("/api/downloads/:id/cancel", (req, res) => {
  const job = cancelDownload(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.post("/api/downloads/:id/retry", (req, res) => {
  const job = retryDownload(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.delete("/api/downloads/:id", (req, res) => {
  store.deleteDownload(req.params.id);
  res.json({ ok: true });
});

app.get("/api/downloads/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);

  const off = onDownloadUpdate((job) => {
    res.write(`data: ${JSON.stringify({ type: "download", job })}\n\n`);
  });
  req.on("close", () => off());
});

app.get("/api/files/:name", (req, res) => {
  const safe = path.basename(req.params.name);
  const primary = path.join(store.downloadDir, safe);
  const completed = path.join(store.downloadDir, "completed", safe);
  const full = fs.existsSync(primary)
    ? primary
    : fs.existsSync(completed)
      ? completed
      : "";
  if (!full) return res.status(404).json({ error: "File not found" });
  res.download(full, safe);
});

app.get("/api/history", (_req, res) => {
  res.json({ history: store.getHistory() });
});

app.delete("/api/history/:id", (req, res) => {
  store.deleteHistory(req.params.id);
  res.json({ ok: true });
});

app.get("/api/recent", (_req, res) => {
  res.json({ recent: store.getRecent() });
});

app.get("/api/settings", (_req, res) => {
  res.json(store.getSettings());
});

app.patch("/api/settings", (req, res) => {
  const schema = z.object({
    defaultQuality: z.string().optional(),
    defaultFormat: z.string().optional(),
    filenameTemplate: z.string().optional(),
    autoSaveCompleted: z.boolean().optional(),
    maxConcurrentDownloads: z.number().int().min(1).max(6).optional(),
    autoBrowserSave: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings" });
  res.json(store.setSettings(parsed.data));
});

app.get("/api/storage", (_req, res) => {
  const completedPath = path.join(store.downloadDir, "completed");
  const listFiles = (dir: string) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((n) => {
          try {
            return fs.statSync(path.join(dir, n)).isFile();
          } catch {
            return false;
          }
        })
      : [];
  const rootFiles = listFiles(store.downloadDir);
  const completedFiles = listFiles(completedPath);
  let used = 0;
  for (const f of rootFiles) used += fs.statSync(path.join(store.downloadDir, f)).size;
  for (const f of completedFiles) used += fs.statSync(path.join(completedPath, f)).size;
  res.json({
    usedBytes: used,
    fileCount: rootFiles.length + completedFiles.length,
    downloadDir: store.downloadDir,
    completedDir: completedPath,
  });
});

app.listen(PORT, () => {
  console.log(`Downloader API on http://127.0.0.1:${PORT}`);
});
