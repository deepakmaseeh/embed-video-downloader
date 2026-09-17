"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { getClientId, getRecentUrls, pushRecentUrl } from "../lib/localStore";

const PRESETS = [
  {
    label: "TH250 Spiritual Formation",
    url: "https://www.biblicaltraining.org/learn/academy/th250-a-guide-to-spiritual-formation",
  },
  {
    label: "OT501 Old Testament",
    url: "https://www.biblicaltraining.org/learn/institute/ot501-survey-of-the-old-testament",
  },
  {
    label: "BT504 Biblical Theology",
    url: "https://www.biblicaltraining.org/learn/institute/survey-of-biblical-theology-bt504",
  },
  {
    label: "TH101 Bible Stories",
    url: "https://www.biblicaltraining.org/learn/foundations/th101-52-major-stories-of-the-bible",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    getClientId();
    setRecent(getRecentUrls());
  }, []);

  async function analyze(target?: string) {
    const value = (target || url).trim();
    if (!value) {
      setError("Paste a webpage or course URL first.");
      return;
    }
    setError("");
    setLoading(true);
    setStage("Starting analysis…");
    try {
      setRecent(pushRecentUrl(value));
      const job = await api.analyze(value);
      localStorage.setItem("lastAnalyzeId", job.id);
      localStorage.setItem("lastAnalyzeUrl", value);

      for (;;) {
        const cur = await api.getAnalyze(job.id);
        setStage(cur.stage || cur.status);
        if (cur.status === "completed") {
          localStorage.setItem("lastAnalyzeResult", JSON.stringify(cur));
          router.push(`/results?id=${cur.id}`);
          return;
        }
        if (cur.status === "failed") {
          const msg = cur.error || "Analysis failed";
          const isCf = /cloudflare/i.test(msg);
          if (isCf && value.includes("biblicaltraining.org")) {
            setStage("Cloudflare blocked once — retrying automatically…");
            await new Promise((r) => setTimeout(r, 2500));
            const retry = await api.analyze(value);
            for (;;) {
              const again = await api.getAnalyze(retry.id);
              setStage(again.stage || again.status);
              if (again.status === "completed") {
                localStorage.setItem("lastAnalyzeResult", JSON.stringify(again));
                router.push(`/results?id=${again.id}`);
                return;
              }
              if (again.status === "failed") throw new Error(again.error || msg);
              await new Promise((r) => setTimeout(r, 900));
            }
          }
          throw new Error(msg);
        }
        await new Promise((r) => setTimeout(r, 900));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-5">
      <section className="panel p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="badge badge-teal">Any course URL</span>
              <span className="badge badge-sky">1080p Vimeo</span>
              <span className="badge badge-ok">Transcripts .txt</span>
            </div>
            <h2 className="display text-2xl font-extrabold text-white sm:text-3xl">Load a course topic</h2>
            <p className="mt-1 max-w-2xl text-sm text-teal-100/55">
              Paste a BiblicalTraining (or embed page) URL to extract every lecture, preview streams, and
              queue videos + transcripts to this browser.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.biblicaltraining.org/learn/..."
            onKeyDown={(e) => e.key === "Enter" && analyze()}
          />
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1 sm:flex-none"
              type="button"
              onClick={async () => {
                const text = await navigator.clipboard.readText().catch(() => "");
                if (text) setUrl(text);
              }}
            >
              Paste
            </button>
            <button className="btn-primary min-w-32 flex-1 sm:flex-none" type="button" disabled={loading} onClick={() => analyze()}>
              {loading ? "Loading…" : "Load topic"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-200/40">Popular courses</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.url}
                type="button"
                className={`chip ${url === p.url ? "chip-active" : ""}`}
                onClick={() => {
                  setUrl(p.url);
                  analyze(p.url);
                }}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
            <p className="font-semibold">Analyzing course…</p>
            <p className="mt-1 text-teal-100/70">{stage}</p>
            <div className="progress-track mt-3">
              <div className="progress-fill pulse" style={{ width: "55%" }} />
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-rose-300">{error}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Detect lectures", "HTML embeds + BiblicalTraining JSON:API → Vimeo HLS with quality options."],
          ["Batch download", "All videos, all transcripts, or selected lessons — concurrent queue."],
          ["Private to you", "History & recent URLs stay in this browser; files save locally."],
        ].map(([title, body]) => (
          <div key={title} className="panel p-4">
            <h3 className="font-bold text-white">{title}</h3>
            <p className="mt-1 text-sm text-teal-100/50">{body}</p>
          </div>
        ))}
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-white">Recent URLs</h2>
        <p className="mb-3 text-xs text-teal-100/40">Saved only in this browser.</p>
        {recent.length === 0 ? (
          <p className="text-sm text-teal-100/45">No recent analyses yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="w-full truncate rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-left text-sm text-teal-50/90 hover:border-teal-400/30"
                  onClick={() => {
                    setUrl(item);
                    analyze(item);
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
