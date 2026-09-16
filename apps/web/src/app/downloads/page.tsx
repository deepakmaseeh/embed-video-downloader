"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { DownloadJob } from "../../lib/types";

function triggerBrowserSave(filename: string) {
  const a = document.createElement("a");
  a.href = api.fileUrl(filename);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [autoBrowserSave, setAutoBrowserSave] = useState(true);
  const [toast, setToast] = useState("");
  const savedIds = useRef<Set<string>>(new Set());
  const autoBrowserSaveRef = useRef(true);

  async function refresh() {
    const data = await api.listDownloads();
    setDownloads(data.downloads || []);
  }

  useEffect(() => {
    autoBrowserSaveRef.current = autoBrowserSave;
  }, [autoBrowserSave]);

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        if (typeof s.autoBrowserSave === "boolean") {
          setAutoBrowserSave(s.autoBrowserSave);
          autoBrowserSaveRef.current = s.autoBrowserSave;
        }
      })
      .catch(() => undefined);

    refresh().catch(() => undefined);
    const es = new EventSource(`${api.base}/api/downloads/events/stream`);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "download" && payload.job) {
          const job = payload.job as DownloadJob;
          setDownloads((prev) => {
            const others = prev.filter((d) => d.id !== job.id);
            return [job, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });

          if (
            job.status === "completed" &&
            job.filename &&
            autoBrowserSaveRef.current &&
            !savedIds.current.has(job.id)
          ) {
            savedIds.current.add(job.id);
            triggerBrowserSave(job.filename);
            if (job.transcriptFilename && job.transcriptFilename !== job.filename) {
              setTimeout(() => triggerBrowserSave(job.transcriptFilename!), 400);
            }
            setToast(`Saved: ${job.filename} (other downloads keep running)`);
            setTimeout(() => setToast(""), 3500);
          }
        }
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(() => refresh().catch(() => undefined), 4000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);

  const activeCount = downloads.filter((d) =>
    ["queued", "preparing", "downloading", "processing", "merging"].includes(d.status)
  ).length;

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-2xl font-bold">Download manager</h2>
          <p className="text-sm text-stone-500">
            {activeCount} active · finished files auto-save to{" "}
            <code className="text-xs">downloads/completed</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={autoBrowserSave}
              onChange={(e) => {
                const v = e.target.checked;
                setAutoBrowserSave(v);
                api.patchSettings({ autoBrowserSave: v }).catch(() => undefined);
              }}
            />
            Auto-save to browser when complete
          </label>
          <button type="button" className="btn-ghost" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-teal-700/20 bg-teal-50 px-4 py-2 text-sm text-teal-900">
          {toast}
        </div>
      )}

      {!downloads.length ? (
        <div className="panel p-6 text-sm text-stone-600">No downloads yet.</div>
      ) : (
        <ul className="space-y-3">
          {downloads.map((job) => (
            <li key={job.id} className="panel p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{job.title}</p>
                  <p className="text-xs text-stone-500">
                    {job.quality} · {job.format.toUpperCase()} · {job.status}
                    {job.autoSaved ? " · auto-saved" : ""}
                    {job.speed ? ` · ${job.speed}` : ""}
                    {job.eta ? ` · ETA ${job.eta}` : ""}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full bg-teal-700 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
                    />
                  </div>
                  {job.error && <p className="mt-2 text-xs text-red-700">{job.error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === "completed" && job.filename ? (
                    <a className="btn-primary" href={api.fileUrl(job.filename)} download={job.filename}>
                      Open / save
                    </a>
                  ) : null}
                  {["failed", "cancelled"].includes(job.status) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => api.retryDownload(job.id).then(refresh)}
                    >
                      Retry
                    </button>
                  ) : null}
                  {!["completed", "failed", "cancelled"].includes(job.status) ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => api.cancelDownload(job.id).then(refresh)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
