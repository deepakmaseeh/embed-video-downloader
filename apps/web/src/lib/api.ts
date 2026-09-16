import { getClientId } from "./localStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8788";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const clientId = typeof window !== "undefined" ? getClientId() : "";
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(clientId ? { "X-Client-Id": clientId } : {}),
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
  /** Browser download URL — includes client id so only your jobs' files are reachable */
  fileUrl: (name: string, purge = true) => {
    const clientId = typeof window !== "undefined" ? getClientId() : "";
    const q = new URLSearchParams();
    if (clientId) q.set("clientId", clientId);
    if (purge) q.set("purge", "1");
    const qs = q.toString();
    return `${API_BASE}/api/files/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`;
  },
  eventsUrl: () => {
    const clientId = typeof window !== "undefined" ? getClientId() : "";
    const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    return `${API_BASE}/api/downloads/events/stream${q}`;
  },
};

export type HistoryEntryLike = import("./localStore").LocalHistoryEntry;
