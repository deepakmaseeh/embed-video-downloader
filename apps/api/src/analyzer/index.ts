import { nanoid } from "nanoid";
import { extractEmbedsFromHtml, type RawEmbed } from "./htmlEmbeds";
import { scanWithPlaywright } from "./playwrightScanner";
import { toMediaItems } from "./ytdlp";
import { analyzeBiblicalTraining, isBiblicalTrainingUrl } from "./biblicalTraining";
import { assertSafeUrl } from "../security/ssrf";
import { store } from "../store/memory";
import type { AnalyzeResult } from "../types";

async function fetchHtml(url: string): Promise<{ finalUrl: string; html: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page`);
  return { finalUrl: res.url || url, html: await res.text() };
}

function mergeEmbeds(lists: RawEmbed[][]): RawEmbed[] {
  const map = new Map<string, RawEmbed>();
  for (const list of lists) {
    for (const emb of list) {
      const existing = map.get(emb.url);
      if (!existing) map.set(emb.url, { ...emb, sources: [...emb.sources] });
      else {
        for (const s of emb.sources) if (!existing.sources.includes(s)) existing.sources.push(s);
      }
    }
  }
  return [...map.values()];
}

export async function runAnalyze(pageUrlInput: string): Promise<AnalyzeResult> {
  const safeUrl = await assertSafeUrl(pageUrlInput);
  const id = nanoid(12);
  const now = new Date().toISOString();
  const job: AnalyzeResult = {
    id,
    pageUrl: safeUrl,
    status: "queued",
    stage: "queued",
    media: [],
    createdAt: now,
    updatedAt: now,
  };
  store.setAnalyze(job);

  void (async () => {
    const update = (patch: Partial<AnalyzeResult>) => {
      const cur = store.getAnalyze(id);
      if (!cur) return;
      store.setAnalyze({ ...cur, ...patch, updatedAt: new Date().toISOString() });
    };

    try {
      update({ status: "running", stage: "Starting analysis" });

      if (isBiblicalTrainingUrl(safeUrl)) {
        try {
          const media = await analyzeBiblicalTraining(safeUrl, (stage) => update({ stage }));
          update({
            status: "completed",
            stage: `Done — ${media.length} BiblicalTraining video(s)`,
            media,
          });
          return;
        } catch (err) {
          // Do not fall through to generic HTML fetch (also Cloudflare-blocked).
          update({
            status: "failed",
            stage: "Failed",
            error: err instanceof Error ? err.message : String(err),
          });
          return;
        }
      }

      update({ stage: "Fetching page HTML" });
      let finalUrl = safeUrl;
      let htmlEmbeds: RawEmbed[] = [];
      let network: RawEmbed[] = [];
      let dom: RawEmbed[] = [];

      try {
        update({ stage: "Scanning with browser (Playwright)" });
        const browser = await scanWithPlaywright(safeUrl);
        finalUrl = browser.finalUrl;
        htmlEmbeds = extractEmbedsFromHtml(browser.finalUrl, browser.html);
        network = browser.networkMedia;
        dom = browser.domMedia;
      } catch (err) {
        update({
          stage: `Browser scan failed, falling back to HTML: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
        const fetched = await fetchHtml(safeUrl);
        finalUrl = fetched.finalUrl;
        htmlEmbeds = extractEmbedsFromHtml(fetched.finalUrl, fetched.html);
      }

      update({ stage: "Merging detected media URLs", pageUrl: finalUrl });
      let merged = mergeEmbeds([htmlEmbeds, network, dom]).slice(0, 40);

      update({ stage: "Probing page URL" });
      const pageItems = await toMediaItems(
        finalUrl,
        [{ url: finalUrl, host: new URL(finalUrl).hostname, sources: ["page-direct"] }],
        { probeLimit: 1 }
      );

      const pageOk = pageItems.filter((m) => m.ytdlpCompatible);
      if (pageOk.length && merged.length <= 1) {
        update({ status: "completed", stage: "Done", media: pageOk });
        return;
      }

      const strong = merged.filter((m) =>
        m.sources.some(
          (s) =>
            ["iframe", "video", "source", "embed", "network", "dom"].includes(s) ||
            s.startsWith("meta:") ||
            s.startsWith("jsonld:")
        )
      );
      if (strong.length) merged = strong;
      merged = merged.filter((m) => m.url !== finalUrl).slice(0, 15);

      update({ stage: `Probing ${Math.min(merged.length, 8)} embed candidates with yt-dlp` });
      const media = await toMediaItems(finalUrl, merged, { probeLimit: 8 });
      const combined = [
        ...pageOk,
        ...media.filter(
          (m) => m.ytdlpCompatible || m.sources.includes("iframe") || m.streamType !== "unknown"
        ),
      ];

      update({
        status: "completed",
        stage: "Done",
        media: combined.length ? combined : media.length ? media : pageItems,
      });
    } catch (err) {
      update({
        status: "failed",
        stage: "Failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  return job;
}
