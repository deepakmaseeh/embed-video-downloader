"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { getClientId, getRecentUrls, pushRecentUrl } from "../lib/localStore";

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
      setError("Paste a webpage URL first.");
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
          throw new Error(cur.error || "Analysis failed");
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
    <main className="space-y-6">
      <section className="panel p-5 sm:p-7">
        <p className="mb-2 text-sm text-stone-600">
          Paste a webpage URL to detect embedded videos, preview them, then download to{" "}
          <strong>this browser</strong>. Recent URLs and history stay on your device only.
        </p>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-stone-500">
          Webpage URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article-with-video"
            onKeyDown={(e) => e.key === "Enter" && analyze()}
          />
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              type="button"
              onClick={async () => {
                const text = await navigator.clipboard.readText().catch(() => "");
                if (text) setUrl(text);
              }}
            >
              Paste
            </button>
            <button className="btn-ghost" type="button" onClick={() => setUrl("")}>
              Clear
            </button>
            <button className="btn-primary min-w-28" type="button" disabled={loading} onClick={() => analyze()}>
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>
        {loading && (
          <div className="mt-4 rounded-xl border border-teal-700/20 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            <p className="font-semibold">Analyzing webpage…</p>
            <p className="mt-1 opacity-80">{stage}</p>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      </section>

      <section className="panel p-5">
        <h2 className="display mb-3 text-xl font-bold">Recent URLs</h2>
        <p className="mb-3 text-xs text-stone-500">Saved in this browser only — not shared with other visitors.</p>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">No recent analyses yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="w-full truncate rounded-xl border border-black/5 bg-white px-3 py-2 text-left text-sm hover:border-teal-700/40"
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

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Detect embeds", "HTML + Playwright network sniff for iframes, HLS, DASH."],
          ["Preview first", "Confirm the right video before any download starts."],
          ["Your browser only", "Files save locally; history/recent stay in localStorage."],
        ].map(([title, body]) => (
          <div key={title} className="panel p-4">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-stone-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
