import { type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getVimeoHlsUrl, downloadBiblicalTrainingTranscript } from "../analyzer/biblicalTraining";
import { spawnYtDlp } from "../analyzer/ytDlpCmd";
import { store } from "../store/memory";
import type { DownloadJob } from "../types";

const listeners = new Set<(job: DownloadJob) => void>();
const activeIds = new Set<string>();
const waitingIds: string[] = [];
const processes = new Map<string, ChildProcess>();

const DEFAULT_MAX_CONCURRENT = 2;

export function onDownloadUpdate(cb: (job: DownloadJob) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(job: DownloadJob) {
  store.setDownload(job);
  for (const cb of listeners) cb(job);
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180);
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] || "");
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m?.[1] || null;
}

function maxConcurrent(): number {
  const n = Number(store.getSettings().maxConcurrentDownloads ?? DEFAULT_MAX_CONCURRENT);
  return Number.isFinite(n) && n >= 1 ? Math.min(6, Math.floor(n)) : DEFAULT_MAX_CONCURRENT;
}

function completedDir(): string {
  const dir = path.join(store.downloadDir, "completed");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Copy finished files into downloads/completed/ without touching in-progress jobs. */
function autoSaveCompleted(files: string[]): { savedAs: string[]; completedDir: string } {
  const destRoot = completedDir();
  const savedAs: string[] = [];
  for (const file of files) {
    if (!file) continue;
    const src = path.isAbsolute(file) ? file : path.join(store.downloadDir, file);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
    // skip temp fragments
    if (/\.part($|-)|-Frag\d+/i.test(path.basename(src))) continue;
    const dest = path.join(destRoot, path.basename(src));
    try {
      fs.copyFileSync(src, dest);
      savedAs.push(path.basename(dest));
    } catch {
      /* ignore copy errors; original still kept */
    }
  }
  return { savedAs, completedDir: destRoot };
}

function findOutputForJob(preferred: string | undefined, base: string): string {
  if (preferred && fs.existsSync(preferred) && fs.statSync(preferred).isFile()) {
    return preferred;
  }
  const candidates = fs
    .readdirSync(store.downloadDir)
    .filter((name) => {
      if (name === "completed" || name.startsWith(".")) return false;
      if (/\.part($|-)|-Frag\d+/i.test(name)) return false;
      const full = path.join(store.downloadDir, name);
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    })
    .filter((name) => name.startsWith(base) || name.includes(base.slice(0, 40)))
    .map((name) => ({ name, full: path.join(store.downloadDir, name), mtime: fs.statSync(path.join(store.downloadDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full || preferred || "";
}

export function enqueueDownload(input: {
  mediaId: string;
  title: string;
  sourcePage: string;
  mediaUrl: string;
  quality: string;
  format: string;
  formatId?: string;
  thumbnail?: string;
  lessonId?: string;
  includeTranscript?: boolean;
  transcriptOnly?: boolean;
  courseTitle?: string;
  instructor?: string;
  clientId?: string;
}): DownloadJob {
  const settings = store.getSettings();
  const id = nanoid(12);
  const now = new Date().toISOString();
  const job: DownloadJob = {
    id,
    mediaId: input.mediaId,
    title: input.title,
    sourcePage: input.sourcePage,
    mediaUrl: input.mediaUrl,
    quality: input.quality || settings.defaultQuality,
    format: input.transcriptOnly ? "txt" : input.format || settings.defaultFormat,
    formatId: input.formatId,
    status: "queued",
    progress: 0,
    thumbnail: input.thumbnail,
    createdAt: now,
    updatedAt: now,
    lessonId: input.lessonId,
    includeTranscript: Boolean(input.includeTranscript || input.transcriptOnly),
    transcriptOnly: Boolean(input.transcriptOnly),
    clientId: input.clientId || undefined,
  };
  (job as DownloadJob & { courseTitle?: string; instructor?: string }).courseTitle = input.courseTitle;
  (job as DownloadJob & { courseTitle?: string; instructor?: string }).instructor = input.instructor;
  emit(job);
  waitingIds.push(id);
  pumpQueue();
  return job;
}

function pumpQueue() {
  while (activeIds.size < maxConcurrent() && waitingIds.length > 0) {
    const nextId = waitingIds.shift();
    if (!nextId) break;
    const job = store.getDownload(nextId);
    if (!job || job.status === "cancelled") continue;
    activeIds.add(nextId);
    void runJob(nextId).finally(() => {
      activeIds.delete(nextId);
      processes.delete(nextId);
      // Continue remaining queue — do not stop other active downloads
      pumpQueue();
    });
  }
}

async function resolveDownloadUrl(job: DownloadJob): Promise<{ url: string; referer?: string }> {
  const vimeoId = extractVimeoId(job.mediaUrl);
  const fromBt = /biblicaltraining\.org/i.test(job.sourcePage);

  if (vimeoId && fromBt) {
    try {
      const hls = await getVimeoHlsUrl(vimeoId);
      return { url: hls, referer: "https://www.biblicaltraining.org/" };
    } catch {
      return { url: job.mediaUrl, referer: "https://www.biblicaltraining.org/" };
    }
  }
  if (vimeoId) {
    return { url: job.mediaUrl, referer: "https://www.biblicaltraining.org/" };
  }
  return { url: job.mediaUrl };
}

async function runJob(jobId: string) {
  const job = store.getDownload(jobId);
  if (!job) return;
  if (job.status === "cancelled" || job.status === "paused") return;

  emit({ ...job, status: "preparing", progress: 1, updatedAt: new Date().toISOString() });

  const settings = store.getSettings();
  const index = String(store.listDownloads().length).padStart(2, "0");
  const base = sanitize(
    applyTemplate(settings.filenameTemplate, {
      index,
      title: job.title || "video",
      quality: job.quality.replace(/\s+/g, ""),
      format: job.format,
      date: new Date().toISOString().slice(0, 10),
      source: (() => {
        try {
          return new URL(job.sourcePage).hostname;
        } catch {
          return "source";
        }
      })(),
    })
  );

  const metaJob = job as DownloadJob & { courseTitle?: string; instructor?: string };

  if (job.includeTranscript && job.lessonId) {
    try {
      emit({
        ...job,
        status: "processing",
        progress: job.transcriptOnly ? 45 : 8,
        updatedAt: new Date().toISOString(),
      });
      const saved = await downloadBiblicalTrainingTranscript({
        lessonId: job.lessonId,
        title: job.title,
        courseTitle: metaJob.courseTitle,
        instructor: metaJob.instructor,
        outDir: store.downloadDir,
      });
      if (saved) {
        job.transcriptFilename = saved.filename;
        emit({
          ...(store.getDownload(jobId) || job),
          transcriptFilename: saved.filename,
          updatedAt: new Date().toISOString(),
        });
      } else if (job.transcriptOnly) {
        emit({
          ...job,
          status: "failed",
          error: "No transcript/outline available for this lesson",
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    } catch (err) {
      if (job.transcriptOnly) {
        emit({
          ...job,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    }
  }

  if (job.transcriptOnly) {
    const cur = store.getDownload(jobId) || job;
    if (cur.transcriptFilename) {
      const filepath = path.join(store.downloadDir, cur.transcriptFilename);
      let savedPath = filepath;
      if (settings.autoSaveCompleted !== false) {
        const { savedAs } = autoSaveCompleted([filepath]);
        if (savedAs[0]) savedPath = path.join(completedDir(), savedAs[0]);
      }
      emit({
        ...cur,
        status: "completed",
        progress: 100,
        filename: path.basename(savedPath),
        filepath: savedPath,
        autoSaved: true,
        updatedAt: new Date().toISOString(),
      });
    } else {
      emit({
        ...cur,
        status: "failed",
        error: "No transcript/outline available for this lesson",
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  let resolved;
  try {
    resolved = await resolveDownloadUrl(job);
  } catch (err) {
    emit({
      ...job,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  // Unique out template so concurrent jobs don't clash
  const outTemplate = path.join(store.downloadDir, `${base}.%(ext)s`);
  const args = ["--no-playlist", "--newline", "-o", outTemplate];

  if (resolved.referer) {
    args.push("--referer", resolved.referer);
    args.push("--add-header", `Referer:${resolved.referer}`);
  }

  if (/\.m3u8(\?|$)/i.test(resolved.url) || extractVimeoId(job.mediaUrl)) {
    args.push("--concurrent-fragments", "16", "--retries", "10", "--fragment-retries", "10");
  }

  if (job.format === "mp3") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "192K");
  } else if (job.format === "m4a") {
    args.push("-x", "--audio-format", "m4a");
  } else if (job.format === "wav") {
    args.push("-x", "--audio-format", "wav");
  } else if (job.formatId) {
    args.push("-f", job.formatId);
  } else if (job.quality.includes("1080")) {
    args.push("-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]", "--merge-output-format", "mp4");
  } else if (job.quality.includes("720")) {
    args.push("-f", "bestvideo[height<=720]+bestaudio/best[height<=720]", "--merge-output-format", "mp4");
  } else if (job.format === "mp4") {
    args.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best", "--merge-output-format", "mp4");
  } else if (job.format === "webm") {
    args.push("-f", "bv*[ext=webm]+ba/b", "--merge-output-format", "webm");
  } else if (job.format === "mkv") {
    args.push("-f", "bv*+ba/b", "--merge-output-format", "mkv");
  } else {
    args.push("-f", "bv*+ba/b");
  }

  args.push(resolved.url);

  await new Promise<void>((resolve) => {
    const child = spawnYtDlp(args);
    processes.set(jobId, child);
    let lastFile = "";

    child.stdout.on("data", (buf) => {
      const line = buf.toString();
      const cur = store.getDownload(jobId);
      if (!cur || cur.status === "cancelled") {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        return;
      }

      const pctMatch = line.match(/(\d+(?:\.\d+)?)%/);
      const speedMatch = line.match(/at\s+(\S+)/);
      const etaMatch = line.match(/ETA\s+(\S+)/);
      const destMatch = line.match(/Destination:\s+(.+)$/m) || line.match(/Merging formats into "(.+)"/);

      if (destMatch?.[1]) lastFile = destMatch[1].replace(/"/g, "").trim();

      let status = cur.status;
      if (/\[download\]/.test(line)) status = "downloading";
      if (/\[Merger\]|Merging|ExtractAudio|ffmpeg/i.test(line)) status = "merging";

      emit({
        ...cur,
        status,
        progress: pctMatch ? Math.min(99, Number(pctMatch[1])) : cur.progress,
        speed: speedMatch?.[1] || cur.speed,
        eta: etaMatch?.[1] || cur.eta,
        updatedAt: new Date().toISOString(),
      });
    });

    child.stderr.on("data", (buf) => {
      const line = buf.toString();
      const cur = store.getDownload(jobId);
      if (!cur) return;
      if (/ERROR/i.test(line)) {
        emit({
          ...cur,
          error: line.trim().slice(0, 500),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    child.on("close", (code) => {
      processes.delete(jobId);
      const cur = store.getDownload(jobId);
      if (!cur) return resolve();
      if (cur.status === "cancelled") return resolve();

      if (code !== 0) {
        emit({
          ...cur,
          status: "failed",
          error: cur.error || `Download failed (exit ${code})`,
          updatedAt: new Date().toISOString(),
        });
        return resolve();
      }

      const filepath = findOutputForJob(lastFile, base);
      let filename = filepath ? path.basename(filepath) : undefined;
      let filesize = filepath && fs.existsSync(filepath) ? fs.statSync(filepath).size : undefined;
      let finalPath = filepath;

      // Auto-save completed copy while other downloads keep running
      if (settings.autoSaveCompleted !== false) {
        const toSave = [filepath, cur.transcriptFilename || job.transcriptFilename]
          .filter(Boolean)
          .map((f) => (path.isAbsolute(String(f)) ? String(f) : path.join(store.downloadDir, String(f))));
        const { savedAs } = autoSaveCompleted(toSave);
        if (savedAs[0]) {
          filename = savedAs[0];
          finalPath = path.join(completedDir(), savedAs[0]);
          filesize = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : filesize;
        }
      }

      const done: DownloadJob = {
        ...cur,
        status: "completed",
        progress: 100,
        filename,
        filepath: finalPath || filepath,
        filesize,
        transcriptFilename: job.transcriptFilename || cur.transcriptFilename,
        autoSaved: settings.autoSaveCompleted !== false,
        updatedAt: new Date().toISOString(),
      };
      emit(done);
      resolve();
    });
  });
}

export function cancelDownload(id: string) {
  const job = store.getDownload(id);
  if (!job) return null;
  // Remove from waiting queue only — do not touch other active jobs
  const widx = waitingIds.indexOf(id);
  if (widx >= 0) waitingIds.splice(widx, 1);
  const proc = processes.get(id);
  if (proc) {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
    processes.delete(id);
  }
  const next = { ...job, status: "cancelled" as const, updatedAt: new Date().toISOString() };
  emit(next);
  return next;
}

export function retryDownload(id: string) {
  const job = store.getDownload(id);
  if (!job) return null;
  const next = {
    ...job,
    status: "queued" as const,
    progress: 0,
    error: undefined,
    updatedAt: new Date().toISOString(),
  };
  emit(next);
  if (!waitingIds.includes(id) && !activeIds.has(id)) waitingIds.push(id);
  pumpQueue();
  return next;
}
