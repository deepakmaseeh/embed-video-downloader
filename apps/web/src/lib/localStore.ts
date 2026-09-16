/** Per-browser identity + recent/history (never shared across users). */

const CLIENT_KEY = "vd_client_id";
const RECENT_KEY = "vd_recent_urls";
const HISTORY_KEY = "vd_history";
const AUTO_BROWSER_SAVE_KEY = "vd_auto_browser_save";
const SAVED_JOBS_KEY = "vd_browser_saved_jobs";

export type LocalHistoryEntry = {
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

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export function getRecentUrls(): string[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<string[]>(localStorage.getItem(RECENT_KEY), []);
  return Array.isArray(list) ? list.filter((u) => typeof u === "string") : [];
}

export function pushRecentUrl(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return getRecentUrls();
  const next = [trimmed, ...getRecentUrls().filter((u) => u !== trimmed)].slice(0, 20);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentUrls() {
  localStorage.removeItem(RECENT_KEY);
}

export function getLocalHistory(): LocalHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<LocalHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
  return Array.isArray(list) ? list : [];
}

export function pushLocalHistory(entry: LocalHistoryEntry): LocalHistoryEntry[] {
  const next = [entry, ...getLocalHistory().filter((h) => h.id !== entry.id)].slice(0, 200);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function removeLocalHistory(id: string): LocalHistoryEntry[] {
  const next = getLocalHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function getAutoBrowserSave(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AUTO_BROWSER_SAVE_KEY);
  if (v === null) return true;
  return v !== "0" && v !== "false";
}

export function setAutoBrowserSave(on: boolean) {
  localStorage.setItem(AUTO_BROWSER_SAVE_KEY, on ? "1" : "0");
}

export function wasJobBrowserSaved(jobId: string): boolean {
  const set = new Set(safeParse<string[]>(localStorage.getItem(SAVED_JOBS_KEY), []));
  return set.has(jobId);
}

export function markJobBrowserSaved(jobId: string) {
  const set = new Set(safeParse<string[]>(localStorage.getItem(SAVED_JOBS_KEY), []));
  set.add(jobId);
  localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify([...set].slice(-500)));
}
