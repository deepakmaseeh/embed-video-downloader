"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import type { AnalyzeResult, MediaItem, MediaVariant } from "../../lib/types";

function formatDuration(sec?: number) {
  if (!sec && sec !== 0) return "";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h) return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function batchItem(item: MediaItem, format: string) {
  return {
    mediaId: item.id,
    title: item.title,
    sourcePage: item.sourcePage,
    mediaUrl: item.mediaUrl,
    quality: "Best Available",
    format,
    formatId: item.variants.find((v) => v.id === "best")?.formatId || item.variants[0]?.formatId,
    thumbnail: item.thumbnail,
    lessonId: item.lessonId,
    courseTitle: item.courseTitle,
    instructor: item.instructor,
  };
}

export default function ResultsPage() {
  const params = useSearchParams();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [quality, setQuality] = useState<MediaVariant | null>(null);
  const [format, setFormat] = useState("mp4");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [batchIncludeTranscript, setBatchIncludeTranscript] = useState(true);

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

  const media = result?.media || [];
  const selectedItems = useMemo(
    () => media.filter((m) => selected[m.id]),
    [media, selected]
  );
  const anyTranscripts = media.some((m) => m.hasTranscript);
  const transcriptCount = media.filter((m) => m.hasTranscript && m.lessonId).length;

  function openPreview(item: MediaItem) {
    setPreview(item);
    setQuality(item.variants[0] || null);
    setIncludeTranscript(Boolean(item.hasTranscript));
    setMessage("");
  }

  function downloadBody(item: MediaItem, withTranscript: boolean, transcriptOnly = false) {
    return {
      mediaId: item.id,
      title: item.title,
      sourcePage: item.sourcePage,
      mediaUrl: item.mediaUrl,
      quality: quality?.quality || "Best Available",
      format: transcriptOnly ? "txt" : format,
      formatId: quality?.formatId,
      thumbnail: item.thumbnail,
      lessonId: item.lessonId,
      includeTranscript: withTranscript || transcriptOnly,
      transcriptOnly,
      courseTitle: item.courseTitle,
      instructor: item.instructor,
    };
  }

  async function downloadOne(item: MediaItem, force = false) {
    setBusy(true);
    setMessage("");
    try {
      const body = downloadBody(item, includeTranscript);
      const job = force ? await api.forceDownload(body) : await api.download(body);
      setMessage(
        includeTranscript && item.hasTranscript
          ? `Queued video + transcript: ${job.title}`
          : `Queued: ${job.title}`
      );
      setPreview(null);
    } catch (err) {
      const e = err as Error & { status?: number; payload?: { existing?: { filename?: string } } };
      if (e.status === 409) {
        const ok = confirm(
          `This video may already exist (${e.payload?.existing?.filename || "file"}).\nDownload again?`
        );
        if (ok) await downloadOne(item, true);
      } else {
        setMessage(e.message || String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function downloadTranscriptOnly(item: MediaItem) {
    if (!item.lessonId) {
      setMessage("No lesson id for transcript.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.downloadTranscript({
        mediaId: item.id,
        title: item.title,
        sourcePage: item.sourcePage,
        lessonId: item.lessonId,
        courseTitle: item.courseTitle,
        instructor: item.instructor,
      });
      setMessage(`Queued transcript (.txt): ${item.title}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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
        items: items.map((item) => batchItem(item, format)),
        includeTranscript: opts.includeTranscript,
        transcriptsOnly: opts.transcriptsOnly,
      });
      setMessage(`${opts.label}: queued ${res.queued}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSelected() {
    await queueBatch(selectedItems, {
      includeTranscript: batchIncludeTranscript,
      label: batchIncludeTranscript
        ? "Selected videos + transcripts"
        : "Selected videos",
    });
  }

  async function downloadSelectedTranscripts() {
    const withTx = selectedItems.filter((m) => m.hasTranscript && m.lessonId);
    await queueBatch(withTx, { transcriptsOnly: true, label: "Selected transcripts" });
  }

  async function downloadAllVideos() {
    await queueBatch(media, { includeTranscript: false, label: "All videos" });
  }

  async function downloadAllTranscripts() {
    const withTx = media.filter((m) => m.hasTranscript && m.lessonId);
    await queueBatch(withTx, { transcriptsOnly: true, label: "All transcripts" });
  }

  async function downloadAllVideosAndTranscripts() {
    await queueBatch(media, {
      includeTranscript: true,
      label: "All videos + transcripts",
    });
  }

  if (!result) {
    return (
      <div className="panel p-6">
        <p className="text-stone-600">No analysis yet. Go to Home and analyze a page.</p>
      </div>
    );
  }

  return (
    <main className="space-y-5">
      <section className="panel p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Source</p>
        <p className="mt-1 break-all text-sm">{result.pageUrl}</p>
        <p className="mt-3 font-semibold">
          Found {media.length} media
          {anyTranscripts ? ` · ${transcriptCount} with transcripts` : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!media.length || busy}
            onClick={downloadAllVideosAndTranscripts}
          >
            Download all (video + transcript)
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!media.length || busy}
            onClick={downloadAllVideos}
          >
            Download all videos
          </button>
          {anyTranscripts && (
            <button
              type="button"
              className="btn-ghost"
              disabled={!transcriptCount || busy}
              onClick={downloadAllTranscripts}
            >
              Download all transcripts (.txt)
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSelected(Object.fromEntries(media.map((m) => [m.id, true])))}
          >
            Select all
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSelected({})}>
            Deselect
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedItems.length || busy}
            onClick={downloadSelected}
          >
            Download {selectedItems.length || ""} selected
          </button>
          {anyTranscripts && (
            <button
              type="button"
              className="btn-ghost"
              disabled={!selectedItems.length || busy}
              onClick={downloadSelectedTranscripts}
            >
              Selected transcripts only
            </button>
          )}
        </div>
        {anyTranscripts && (
          <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={batchIncludeTranscript}
              onChange={(e) => setBatchIncludeTranscript(e.target.checked)}
            />
            Include transcripts (.txt) with selected videos when available
          </label>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {["mp4", "webm", "mkv", "mp3", "m4a"].map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${format === f ? "chip-active" : ""}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-sm text-teal-800">{message}</p>}
      </section>

      {!media.length ? (
        <section className="panel p-6">
          <h2 className="display text-xl font-bold">No downloadable media found</h2>
          <p className="mt-2 text-sm text-stone-600">
            The page may contain no accessible video, protected media, or unsupported formats.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <article key={item.id} className="panel overflow-hidden">
              <div className="relative aspect-video bg-stone-200">
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-500">
                    No thumbnail
                  </div>
                )}
                {item.duration ? (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                    {formatDuration(item.duration)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[item.id])}
                    onChange={(e) => setSelected((s) => ({ ...s, [item.id]: e.target.checked }))}
                  />
                  <span>
                    <span className="block font-semibold leading-snug">{item.title}</span>
                    <span className="mt-1 block text-xs text-stone-500">
                      {item.host} · {item.streamType} · {item.variants[0]?.quality || "—"}
                      {item.hasTranscript ? " · transcript available" : ""}
                    </span>
                  </span>
                </label>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => openPreview(item)}>
                    Preview
                  </button>
                  <button type="button" className="btn-primary flex-1" onClick={() => openPreview(item)}>
                    Download
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
          <div className="panel max-h-[95vh] w-full max-w-3xl overflow-auto rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <h2 className="display text-xl font-bold">Preview</h2>
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
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/90">
                    <p>In-browser preview unavailable for this source.</p>
                    <p className="text-white/60">Choose quality and download anyway.</p>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold">{preview.title}</h3>
                <p className="text-sm text-stone-500">
                  {[formatDuration(preview.duration), preview.host, preview.extractor]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Quality</p>
                <div className="flex flex-wrap gap-2">
                  {preview.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`chip ${quality?.id === v.id ? "chip-active" : ""}`}
                      onClick={() => setQuality(v)}
                    >
                      {v.quality}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Format</p>
                <div className="flex flex-wrap gap-2">
                  {["mp4", "webm", "mkv", "mp3", "m4a", "wav"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`chip ${format === f ? "chip-active" : ""}`}
                      onClick={() => setFormat(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {preview.hasTranscript && (
                <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeTranscript}
                    onChange={(e) => setIncludeTranscript(e.target.checked)}
                  />
                  Also download transcript / outline (.txt)
                </label>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy}
                  onClick={() => downloadOne(preview)}
                >
                  {busy
                    ? "Queuing…"
                    : includeTranscript && preview.hasTranscript
                      ? "Download video + transcript"
                      : "Download video"}
                </button>
                {preview.hasTranscript && preview.lessonId ? (
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    disabled={busy}
                    onClick={() => downloadTranscriptOnly(preview)}
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
