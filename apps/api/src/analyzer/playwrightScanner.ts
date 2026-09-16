import type { RawEmbed } from "./htmlEmbeds";
import { extractEmbedsFromHtml } from "./htmlEmbeds";

export interface BrowserScanResult {
  finalUrl: string;
  html: string;
  networkMedia: RawEmbed[];
  domMedia: RawEmbed[];
}

export async function scanWithPlaywright(
  pageUrl: string,
  options?: { timeoutMs?: number }
): Promise<BrowserScanResult> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is not installed");
  }

  const timeoutMs = options?.timeoutMs ?? 25000;
  const networkMap = new Map<string, RawEmbed>();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
  } catch (err) {
    throw new Error(
      `Playwright browser unavailable (${err instanceof Error ? err.message : String(err)}). Using HTML fallback.`
    );
  }

  const pushUnique = (map: Map<string, RawEmbed>, url: string, source: string) => {
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) return;
      u.hash = "";
      const key = u.toString();
      const existing = map.get(key);
      if (!existing) map.set(key, { url: key, host: u.hostname, sources: [source] });
      else if (!existing.sources.includes(source)) existing.sources.push(source);
    } catch {
      /* ignore */
    }
  };

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
    });
    const page = await context.newPage();
    const MEDIA_HINT = /\.(m3u8|mpd|mp4|webm|m4v|mov)(\?|$)/i;

    page.on("response", (resp) => {
      try {
        const url = resp.url();
        const ct = (resp.headers()["content-type"] || "").toLowerCase();
        if (
          MEDIA_HINT.test(url) ||
          ct.includes("mpegurl") ||
          ct.includes("dash+xml") ||
          ct.includes("video/") ||
          ct.includes("application/vnd.apple.mpegurl")
        ) {
          pushUnique(networkMap, url, "network");
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(2500);

    const html = await page.content();
    const finalUrl = page.url();
    const domMedia = await page.evaluate(() => {
      const urls: string[] = [];
      document.querySelectorAll("video, source, iframe, embed").forEach((el) => {
        const src =
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          (el as HTMLVideoElement).currentSrc ||
          "";
        if (src) urls.push(src);
      });
      return urls;
    });

    const domMap = new Map<string, RawEmbed>();
    for (const src of domMedia) pushUnique(domMap, new URL(src, finalUrl).toString(), "dom");
    for (const emb of extractEmbedsFromHtml(finalUrl, html)) {
      const existing = domMap.get(emb.url);
      if (!existing) domMap.set(emb.url, emb);
      else for (const s of emb.sources) if (!existing.sources.includes(s)) existing.sources.push(s);
    }

    await context.close();
    return {
      finalUrl,
      html,
      networkMedia: [...networkMap.values()],
      domMedia: [...domMap.values()],
    };
  } finally {
    await browser.close();
  }
}
