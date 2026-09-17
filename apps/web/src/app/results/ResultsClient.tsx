"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import type { AnalyzeResult, DownloadJob, MediaItem, MediaVariant } from "../../lib/types";

type FilterTab = "all" | "pending" | "completed";
type QualityKey = "1080" | "720" | "480" | "best";

function formatDuration(sec?: number) {
  if (!sec && sec !== 0) return "";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h) return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function pickVariant(item: MediaItem, quality: QualityKey): MediaVariant | undefined {
  if (quality === "best") {
    return item.variants.find((v) => v.id === "best") || item.variants[0];
  }
  const height = Number(quality);
  return (
    item.variants.find((v) => v.id === quality || v.height === height) ||
    item.variants.find((v) => (v.height || 0) <= height && (v.height || 0) > 0) ||
    item.variants.find((v) => v.id === "best") ||
    item.variants[0]
  );
}

function batchItem(item: MediaItem, format: string, quality: QualityKey) {
  const variant = pickVariant(item, quality);
  return {
    mediaId: item.id,
    title: item.title,
    sourcePage: item.sourcePage,
    mediaUrl: item.mediaUrl,
    quality: variant?.quality || "Best Available",
    format,
    formatId: variant?.formatId,
    thumbnail: item.thumbnail,
    lessonId: item.lessonId,
    courseTitle: item.courseTitle,
    instructor: item.instructor,
  };
}

function lessonNumber(item: MediaItem): number {
  const m = item.title.match(/^(\d+)\s*[—\-]/);
  if (m) return Number(m[1]);
  return 0;
}

export default function ResultsPage() {
  const params = useSearchParams();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [qualityKey, setQualityKey] = useState<QualityKey>("1080");
  const [format] = useState("mp4");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [jobsByMedia, setJobsByMedia] = useState<Record<string, DownloadJob>>({});
  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);

  useEffect(() => {
    const id = params.get("id") || localStorage.getItem("lastAnalyzeId");
    async function load() {
      if (id) {
        try {
          const data = await api.getAnalyze(id);
          setResult(data);
          return;
        } catch {
          /* fall through */
        }
      }
      const cached = localStorage.getItem("lastAnalyzeResult");
      if (cached) setResult(JSON.parse(cached));
    }
    load();
  }, [params]);

  useEffect(() => {
    const es = new EventSource(api.eventsUrl());
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type !== "download" || !payload.job) return;
        const job = payload.job as DownloadJob;
        setJobsByMedia((prev) => ({ ...prev, [job.mediaId]: job }));
        const active = ["queued", "preparing", "downloading", "processing", "merging"].includes(job.status);
        setActiveJob((cur) => {
          if (active) return job;
          if (cur?.id === job.id) return null;
          return cur;
        });
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  const media = useMemo(() => result?.media || [], [result]);
  const courseTitle =
    media.find((m) => m.courseTitle)?.courseTitle ||
    (media.length ? "Detected media" : "No course loaded");
  const instructor = media.find((m) => m.instructor)?.instructor || "—";
  const transcriptCount = media.filter((m) => m.hasTranscript && m.lessonId).length;
  const anyTranscripts = transcriptCount > 0;

  const completedCount = media.filter((m) => jobsByMedia[m.id]?.status === "completed").length;
  const queuedCount = media.filter((m) =>
    ["queued", "preparing", "downloading", "processing", "merging"].includes(jobsByMedia[m.id]?.status || "")
  ).length;
  const overallPct = media.length ? Math.round((completedCount / media.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media
      .filter((m) => {
        const job = jobsByMedia[m.id];
        const done = job?.status === "completed";
        if (filter === "completed" && !done) return false;
        if (filter === "pending" && done) return false;
        if (!q) return true;
        return m.title.toLowerCase().includes(q) || String(lessonNumber(m)).includes(q);
      })
      .sort((a, b) => lessonNumber(a) - lessonNumber(b) || a.title.localeCompare(b.title));
  }, [media, search, filter, jobsByMedia]);

  const selectedItems = useMemo(() => media.filter((m) => selected[m.id]), [media, selected]);

  async function queueBatch(
    items: MediaItem[],
    opts: { includeTranscript?: boolean; transcriptsOnly?: boolean; label: string }
  ) {
    if (!items.length) {
      setMessage("Nothing to queue.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await api.downloadBatch({
        items: items.map((item) => batchItem(item, format, qualityKey)),
        includeTranscript: opts.includeTranscript,
        transcriptsOnly: opts.transcriptsOnly,
      });
      setMessage(`${opts.label}: queued ${res.queued}`);
      setSelected({});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadOne(item: MediaItem) {
    setBusy(true);
    setMessage("");
    try {
      const variant = pickVariant(item, qualityKey);
      await api.forceDownload({
        ...batchItem(item, format, qualityKey),
        includeTranscript: Boolean(item.hasTranscript),
        quality: variant?.quality || "Best Available",
        formatId: variant?.formatId,
      });
      setMessage(`Queued: ${item.title}`);
      setPreview(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!result) {
    return (
      <div className="panel p-6">
        <p className="text-teal-100/60">No analysis yet. Go to Home and load a course URL.</p>
      </div>
    );
  }

  const qualityLabel =
    qualityKey === "best" ? "Best" : qualityKey === "1080" ? "1080p" : qualityKey === "720" ? "720p" : "480p";

  return (
    <main className="space-y-4 sm:space-y-5">
      {/* Course hero */}
      <section className="panel overflow-hidden">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="badge badge-teal">Course collection</span>
              <span className="badge badge-sky">Direct Vimeo / embeds</span>
              {anyTranscripts ? <span className="badge badge-ok">Transcripts available</span> : null}
              <span className="badge badge-warn">{qualityLabel} target</span>
            </div>
            <h2 className="display text-2xl font-extrabold leading-tight text-white sm:text-3xl">{courseTitle}</h2>
            <p className="mt-2 text-sm text-teal-100/60">
              Instructor: <strong className="text-teal-50">{instructor}</strong>
              {" · "}
              <span>{media.length} lecture{media.length === 1 ? "" : "s"}</span>
              {transcriptCount ? ` · ${transcriptCount} with transcript` : ""}
            </p>
            <p className="mt-2 break-all text-xs text-teal-100/35">{result.pageUrl}</p>
            <div className="mt-3 rounded-xl border border-teal-400/15 bg-black/25 px-3 py-2 text-xs text-teal-100/65">
              Saves to <strong className="text-teal-50">this browser</strong> (auto Save As). History stays private on
              your device.
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="btn-primary btn-large"
                disabled={!media.length || busy}
                onClick={() =>
                  queueBatch(media, {
                    includeTranscript: true,
                    label: `All videos + transcripts (${qualityLabel})`,
                  })
                }
              >
                Download all videos ({qualityLabel})
              </button>
              {anyTranscripts && (
                <button
                  type="button"
                  className="btn-secondary btn-large"
                  disabled={busy || !transcriptCount}
                  onClick={() =>
                    queueBatch(
                      media.filter((m) => m.hasTranscript && m.lessonId),
                      { transcriptsOnly: true, label: "All transcripts" }
                    )
                  }
                >
                  Download all transcripts (.txt)
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={!selectedItems.length || busy}
                onClick={() =>
                  queueBatch(selectedItems, {
                    includeTranscript: true,
                    label: "Selected",
                  })
                }
              >
                Download selected ({selectedItems.length})
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/5 bg-black/25 p-4">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-teal-200/50">Collection stats</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Total lessons", String(media.length)],
                ["Videos done", `${completedCount} / ${media.length}`],
                ["Transcripts", `${transcriptCount}`],
                ["In queue", String(queuedCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-100/40">{label}</p>
                  <p className="mt-1 text-xl font-extrabold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-teal-100/50">
                <span>Video completion</span>
                <span className="mono">{overallPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Active download banner */}
      {activeJob && (
        <section className="panel border-teal-400/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-400" />
                <span className="badge badge-sky">Downloading</span>
                <h3 className="truncate font-bold text-white">{activeJob.title}</h3>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-teal-100/55">
                <span>
                  Progress: <strong className="mono text-teal-50">{activeJob.progress.toFixed(1)}%</strong>
                </span>
                <span>
                  Speed: <strong className="mono text-teal-50">{activeJob.speed || "—"}</strong>
                </span>
                <span>
                  ETA: <strong className="mono text-teal-50">{activeJob.eta || "—"}</strong>
                </span>
                {activeJob.filename ? (
                  <span className="mono truncate max-w-full sm:max-w-xs">{activeJob.filename}</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="btn-danger"
              onClick={() => api.cancelDownload(activeJob.id).catch(() => undefined)}
            >
              Cancel
            </button>
          </div>
          <div className="progress-track mt-3 h-2.5">
            <div
              className="progress-fill pulse"
              style={{ width: `${Math.max(0, Math.min(100, activeJob.progress))}%` }}
            />
          </div>
        </section>
      )}

      {/* Toolbar */}
      <section className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <input
            className="input pl-10"
            placeholder="Search lessons by title or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teal-100/35">⌕</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", `All (${media.length})`],
              ["pending", `Pending (${media.length - completedCount})`],
              ["completed", `Done (${completedCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip ${filter === key ? "chip-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["1080", "720", "480", "best"] as QualityKey[]).map((q) => (
            <button
              key={q}
              type="button"
              className={`chip ${qualityKey === q ? "chip-active" : ""}`}
              onClick={() => setQualityKey(q)}
            >
              {q === "best" ? "Best" : `${q}p`}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSelected(Object.fromEntries(media.map((m) => [m.id, true])))}
          >
            Select all
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSelected({})}>
            Clear
          </button>
        </div>
      </section>

      {message && (
        <div className="toast text-sm text-teal-100">
          {message}
        </div>
      )}

      {!media.length ? (
        <section className="panel p-6">
          <h2 className="text-xl font-bold text-white">No downloadable media found</h2>
          <p className="mt-2 text-sm text-teal-100/50">
            The page may contain protected media, Cloudflare blocks, or unsupported formats.
          </p>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const job = jobsByMedia[item.id];
            const status = job?.status || "idle";
            const done = status === "completed";
            const active = ["queued", "preparing", "downloading", "processing", "merging"].includes(status);
            const num = lessonNumber(item);
            return (
              <article
                key={item.id}
                className={`panel flex flex-col overflow-hidden transition ${
                  selected[item.id] ? "ring-1 ring-teal-400/40" : ""
                }`}
              >
                <div className="relative aspect-video bg-black/40">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail} alt="" className="h-full w-full object-cover opacity-90" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-teal-100/40">No thumbnail</div>
                  )}
                  {item.duration ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-xs text-white mono">
                      {formatDuration(item.duration)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3.5">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selected[item.id])}
                      onChange={(e) => setSelected((s) => ({ ...s, [item.id]: e.target.checked }))}
                    />
                    <span className="min-w-0">
                      <span className="mb-1.5 flex flex-wrap gap-1.5">
                        {num ? <span className="badge">Lesson {String(num).padStart(2, "0")}</span> : null}
                        <span className={`badge ${done ? "badge-ok" : "badge-teal"}`}>
                          {done ? "Saved" : qualityLabel}
                        </span>
                        {item.hasTranscript ? <span className="badge badge-sky">Transcript</span> : null}
                      </span>
                      <span className="block font-semibold leading-snug text-white">{item.title}</span>
                      <span className="mt-1 block text-[11px] text-teal-100/40">
                        {item.host}
                        {item.vimeoId ? ` · Vimeo ${item.vimeoId}` : ""}
                        {item.extractor ? ` · ${item.extractor}` : ""}
                      </span>
                    </span>
                  </label>

                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-teal-100/45">
                      <span>
                        {active
                          ? `Downloading ${Math.floor(job?.progress || 0)}%`
                          : done
                            ? "Completed"
                            : status === "failed"
                              ? "Failed"
                              : "Ready"}
                      </span>
                      <span className="mono">
                        {job?.speed || ""}
                        {job?.eta ? ` · ${job.eta}` : ""}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${active ? "pulse" : ""}`}
                        style={{
                          width: `${done ? 100 : Math.max(0, Math.min(100, job?.progress || 0))}%`,
                        }}
                      />
                    </div>
                    {job?.error ? <p className="mt-1 text-[11px] text-rose-300">{job.error}</p> : null}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <button type="button" className="btn-ghost flex-1" onClick={() => setPreview(item)}>
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      disabled={busy || active}
                      onClick={() => downloadOne(item)}
                    >
                      {done ? "Re-download" : "Download"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
          <div className="panel max-h-[95vh] w-full max-w-3xl overflow-auto rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h2 className="display text-xl font-bold text-white">Preview</h2>
              <button type="button" className="btn-ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                {preview.previewUrl?.includes("player.vimeo.com") ? (
                  <iframe
                    className="h-full w-full"
                    src={preview.previewUrl}
                    title={preview.title}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : preview.previewUrl || /\.(mp4|webm|m3u8)(\?|$)/i.test(preview.mediaUrl) ? (
                  <video
                    className="h-full w-full"
                    controls
                    playsInline
                    poster={preview.thumbnail}
                    src={preview.previewUrl || preview.mediaUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/70">
                    In-browser preview unavailable — download still works.
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white">{preview.title}</h3>
                <p className="text-sm text-teal-100/50">
                  {[formatDuration(preview.duration), preview.host, preview.instructor, preview.courseTitle]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {preview.vimeoId ? (
                  <p className="mt-1 mono text-xs text-teal-100/40">Vimeo ID: {preview.vimeoId}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["1080", "720", "480", "best"] as QualityKey[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`chip ${qualityKey === q ? "chip-active" : ""}`}
                    onClick={() => setQualityKey(q)}
                  >
                    {q === "best" ? "Best" : `${q}p`}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy}
                  onClick={() => downloadOne(preview)}
                >
                  {busy ? "Queuing…" : `Download video (${qualityLabel})`}
                </button>
                {preview.hasTranscript && preview.lessonId ? (
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    disabled={busy}
                    onClick={() =>
                      queueBatch([preview], { transcriptsOnly: true, label: "Transcript" }).then(() =>
                        setPreview(null)
                      )
                    }
                  >
                    Transcript only (.txt)
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
