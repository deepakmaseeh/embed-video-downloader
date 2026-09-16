import fs from "fs";
import path from "path";
import type { AnalyzeResult, AppSettings, DownloadJob, HistoryEntry } from "../types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DOWNLOAD_DIR = path.resolve(process.cwd(), "downloads");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

ensureDirs();

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

const analyzes = new Map<string, AnalyzeResult>();
const downloads = new Map<string, DownloadJob>();
let recentUrls: string[] = readJson<string[]>(path.join(DATA_DIR, "recent.json"), []);
let history: HistoryEntry[] = readJson<HistoryEntry[]>(path.join(DATA_DIR, "history.json"), []);
let settings: AppSettings = readJson<AppSettings>(path.join(DATA_DIR, "settings.json"), {
  defaultQuality: "Best Available",
  defaultFormat: "mp4",
  filenameTemplate: "{index}_{title}_{quality}",
  autoSaveCompleted: true,
  maxConcurrentDownloads: 2,
  autoBrowserSave: true,
});

function ensureCompletedDir() {
  fs.mkdirSync(path.join(DOWNLOAD_DIR, "completed"), { recursive: true });
}
ensureCompletedDir();

export const store = {
  downloadDir: DOWNLOAD_DIR,

  getAnalyze(id: string) {
    return analyzes.get(id);
  },
  setAnalyze(job: AnalyzeResult) {
    analyzes.set(job.id, job);
  },

  listDownloads() {
    return [...downloads.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getDownload(id: string) {
    return downloads.get(id);
  },
  setDownload(job: DownloadJob) {
    downloads.set(job.id, job);
  },
  deleteDownload(id: string) {
    downloads.delete(id);
  },

  getRecent() {
    return recentUrls;
  },
  pushRecent(url: string) {
    recentUrls = [url, ...recentUrls.filter((u) => u !== url)].slice(0, 20);
    writeJson(path.join(DATA_DIR, "recent.json"), recentUrls);
  },

  getHistory() {
    return history;
  },
  pushHistory(entry: HistoryEntry) {
    history = [entry, ...history].slice(0, 200);
    writeJson(path.join(DATA_DIR, "history.json"), history);
  },
  deleteHistory(id: string) {
    history = history.filter((h) => h.id !== id);
    writeJson(path.join(DATA_DIR, "history.json"), history);
  },

  getSettings() {
    return {
      defaultQuality: "Best Available",
      defaultFormat: "mp4",
      filenameTemplate: "{index}_{title}_{quality}",
      autoSaveCompleted: true,
      maxConcurrentDownloads: 2,
      autoBrowserSave: true,
      ...settings,
    };
  },
  setSettings(next: Partial<AppSettings>) {
    settings = { ...this.getSettings(), ...next };
    writeJson(path.join(DATA_DIR, "settings.json"), settings);
    return settings;
  },
};
