import * as cheerio from "cheerio";
import { URL } from "url";

export interface RawEmbed {
  url: string;
  host: string;
  sources: string[];
}

const EMBED_HINTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "wistia.com",
  "wistia.net",
  "brightcove",
  "jwplatform.com",
  "cdn.jwplayer.com",
  "streamable.com",
  "twitch.tv",
  "player.twitch.tv",
  "facebook.com/plugins/video",
  "tiktok.com",
  "rumble.com",
  "loom.com",
  "vidyard.com",
  "kaltura.com",
  "cloudflarestream.com",
  "/embed/",
  "/player/",
  ".m3u8",
  ".mpd",
  ".mp4",
  ".webm",
  ".m4v",
];

const MEDIA_EXT = [".mp4", ".webm", ".m3u8", ".mpd", ".mov", ".m4v", ".mkv", ".mp3", ".m4a"];
const URL_RE = /https?:\/\/[^\s"'<>\\]+|\/\/[^\s"'<>\\]+/gi;
const YT_RE =
  /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/i;

function cleanUrl(raw: string, base: string): string | null {
  if (!raw) return null;
  let u = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!u || /^(javascript:|data:|mailto:|#)/i.test(u)) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  try {
    const abs = new URL(u, base);
    if (!["http:", "https:"].includes(abs.protocol)) return null;
    abs.hash = "";
    return abs.toString();
  } catch {
    return null;
  }
}

function looksLikeMedia(url: string): boolean {
  const low = url.toLowerCase();
  if (EMBED_HINTS.some((h) => low.includes(h))) return true;
  try {
    const path = new URL(low).pathname;
    return MEDIA_EXT.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

function normalizeKnown(url: string): string {
  const yt = url.match(YT_RE);
  if (yt?.[1]) return `https://www.youtube.com/watch?v=${yt[1]}`;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("player.vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) return `https://vimeo.com/${id}`;
    }
    if (host.includes("dailymotion.com") && parsed.pathname.includes("/embed/video/")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://www.dailymotion.com/video/${id}`;
    }
  } catch {
    /* ignore */
  }
  return url;
}

function add(map: Map<string, RawEmbed>, raw: string | undefined, source: string, base: string) {
  const cleaned = cleanUrl(raw || "", base);
  if (!cleaned || !looksLikeMedia(cleaned)) return;
  const url = normalizeKnown(cleaned);
  const existing = map.get(url);
  if (!existing) {
    map.set(url, { url, host: new URL(url).hostname, sources: [source] });
  } else if (!existing.sources.includes(source)) {
    existing.sources.push(source);
  }
}

export function extractEmbedsFromHtml(pageUrl: string, html: string): RawEmbed[] {
  const map = new Map<string, RawEmbed>();
  const $ = cheerio.load(html);

  $("iframe").each((_, el) => {
    add(map, $(el).attr("src") || $(el).attr("data-src"), "iframe", pageUrl);
  });
  $("video, source, embed, object").each((_, el) => {
    const tag = (el as { name?: string }).name || "media";
    add(
      map,
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data") || $(el).attr("data-url"),
      tag,
      pageUrl
    );
  });
  $("meta").each((_, el) => {
    const prop = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
    if (
      ["og:video", "og:video:url", "og:video:secure_url", "twitter:player", "twitter:player:stream"].includes(
        prop
      )
    ) {
      add(map, $(el).attr("content"), `meta:${prop}`, pageUrl);
    }
  });
  $("[data-video-url]").each((_, el) => add(map, $(el).attr("data-video-url"), "data-video-url", pageUrl));

  $('script[type*="ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (types.some((t: unknown) => String(t).toLowerCase() === "videoobject")) {
          add(map, item.contentUrl, "jsonld:contentUrl", pageUrl);
          add(map, item.embedUrl, "jsonld:embedUrl", pageUrl);
          add(map, item.url, "jsonld:url", pageUrl);
        }
      }
    } catch {
      /* ignore bad json-ld */
    }
  });

  const matches = html.match(URL_RE) || [];
  for (const m of matches) add(map, m, "page-text", pageUrl);

  return [...map.values()].sort((a, b) => {
    const score = (h: string) =>
      h.includes("youtube") || h.includes("vimeo") || h.includes("m3u8") || h.includes("mpd") ? 0 : 1;
    return score(a.host) - score(b.host) || a.url.localeCompare(b.url);
  });
}
