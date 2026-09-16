const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8788";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export const api = {
  base: API_BASE,
  analyze: (url: string) =>
    req<import("./types").AnalyzeResult>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  getAnalyze: (id: string) => req<import("./types").AnalyzeResult>(`/api/analyze/${id}`),
  download: (body: Record<string, unknown>) =>
    req<import("./types").DownloadJob>("/api/download", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forceDownload: (body: Record<string, unknown>) =>
    req<import("./types").DownloadJob>("/api/download/force", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadTranscript: (body: Record<string, unknown>) =>
    req<import("./types").DownloadJob>("/api/transcript", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadBatch: (body: {
    items: Record<string, unknown>[];
    includeTranscript?: boolean;
    transcriptsOnly?: boolean;
  }) =>
    req<{ queued: number; jobs: import("./types").DownloadJob[] }>("/api/download/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listDownloads: () =>
    req<{ downloads: import("./types").DownloadJob[] }>("/api/downloads"),
  cancelDownload: (id: string) =>
    req(`/api/downloads/${id}/cancel`, { method: "POST" }),
  retryDownload: (id: string) =>
    req(`/api/downloads/${id}/retry`, { method: "POST" }),
  recent: () => req<{ recent: string[] }>("/api/recent"),
  history: () => req<{ history: import("./types").HistoryEntryLike[] }>("/api/history"),
  settings: () => req<import("./types").AppSettings>("/api/settings"),
  patchSettings: (body: Partial<import("./types").AppSettings>) =>
    req<import("./types").AppSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  storage: () =>
    req<{
      usedBytes: number;
      fileCount: number;
      downloadDir: string;
      completedDir?: string;
    }>("/api/storage"),
  fileUrl: (name: string) => `${API_BASE}/api/files/${encodeURIComponent(name)}`,
};

export type HistoryEntryLike = {
  id: string;
  title: string;
  sourcePage: string;
  filename: string;
  quality: string;
  format: string;
  status: string;
  filesize?: number;
  createdAt: string;
};
