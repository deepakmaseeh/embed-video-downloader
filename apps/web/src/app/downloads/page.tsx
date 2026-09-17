"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DownloadJob } from "../../lib/types";
import { getAutoBrowserSave, setAutoBrowserSave as persistAutoBrowserSave } from "../../lib/localStore";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [autoBrowserSave, setAutoBrowserSave] = useState(true);
  const [toast, setToast] = useState("");

  async function refresh() {
    const data = await api.listDownloads();
    setDownloads(data.downloads || []);
  }

  useEffect(() => {
    setAutoBrowserSave(getAutoBrowserSave());
    refresh().catch(() => undefined);
    const es = new EventSource(api.eventsUrl());
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "download" && payload.job) {
          const job = payload.job as DownloadJob;
          setDownloads((prev) => {
            const others = prev.filter((d) => d.id !== job.id);
            return [job, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });
          if (job.status === "completed" && job.filename) {
            setToast(`Saved to this browser: ${job.filename}`);
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
          <h2 className="display text-2xl font-extrabold text-white">Download queue</h2>
          <p className="text-sm text-teal-100/50">
            {activeCount} active · only your jobs · files save to this browser
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-teal-50">
            <input
              type="checkbox"
              checked={autoBrowserSave}
              onChange={(e) => {
                const v = e.target.checked;
                setAutoBrowserSave(v);
                persistAutoBrowserSave(v);
              }}
            />
            Auto-save when complete
          </label>
          <button type="button" className="btn-ghost" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {toast && <div className="toast text-sm text-teal-100">{toast}</div>}

      {!downloads.length ? (
        <div className="panel p-6 text-sm text-teal-100/55">No downloads yet in this browser session.</div>
      ) : (
        <ul className="space-y-3">
          {downloads.map((job) => (
            <li key={job.id} className="panel p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{job.title}</p>
                  <p className="text-xs text-teal-100/45">
                    {job.quality} · {job.format.toUpperCase()} · {job.status}
                    {job.speed ? ` · ${job.speed}` : ""}
                    {job.eta ? ` · ETA ${job.eta}` : ""}
                  </p>
                  <div className="progress-track mt-2">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
                    />
                  </div>
                  {job.error && <p className="mt-2 text-xs text-rose-300">{job.error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === "completed" && job.filename ? (
                    <a className="btn-primary" href={api.fileUrl(job.filename, false)} download={job.filename}>
                      Save again
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
