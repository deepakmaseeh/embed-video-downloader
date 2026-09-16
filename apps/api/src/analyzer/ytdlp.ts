import type { MediaItem, MediaVariant, StreamType } from "../types";
import { nanoid } from "nanoid";
import type { RawEmbed } from "./htmlEmbeds";
import { spawnYtDlp } from "./ytDlpCmd";

export interface YtDlpProbe {
  ok: boolean;
  title?: string;
  duration?: number;
  thumbnail?: string;
  extractor?: string;
  webpageUrl?: string;
  variants: MediaVariant[];
  previewUrl?: string;
  streamType: StreamType;
  error?: string;
}

function runYtDlpJson(url: string, timeoutMs = 45000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawnYtDlp(["-J", "--no-playlist", "--no-warnings", url]);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("yt-dlp probe timed out"));
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function qualityLabel(height?: number, note?: string): string {
  if (height && height >= 2160) return "2160p";
  if (height && height >= 1440) return "1440p";
  if (height && height >= 1080) return "1080p";
  if (height && height >= 720) return "720p";
  if (height && height >= 480) return "480p";
  if (height && height >= 360) return "360p";
  if (height && height >= 240) return "240p";
  if (note) return note;
  return "best";
}

export async function probeWithYtDlp(url: string): Promise<YtDlpProbe> {
  try {
    const info = (await runYtDlpJson(url)) as Record<string, unknown>;
    let entry = info;
    if (Array.isArray(info.entries) && info.entries[0]) {
      entry = info.entries.find(Boolean) as Record<string, unknown>;
    }

    const formats = (entry.formats as Record<string, unknown>[]) || [];
    const variants: MediaVariant[] = [];
    for (const f of formats) {
      const height = typeof f.height === "number" ? f.height : undefined;
      const vcodec = String(f.vcodec || "none");
      const acodec = String(f.acodec || "none");
      if (vcodec === "none" && acodec === "none") continue;
      // Prefer combined or video-capable formats for quality list
      if (!height && vcodec === "none") continue;
      variants.push({
        id: String(f.format_id),
        quality: qualityLabel(height, String(f.format_note || "")),
        width: typeof f.width === "number" ? f.width : undefined,
        height,
        fps: typeof f.fps === "number" ? f.fps : undefined,
        bitrate: typeof f.tbr === "number" ? Math.round(Number(f.tbr) * 1000) : undefined,
        videoCodec: vcodec !== "none" ? vcodec : undefined,
        audioCodec: acodec !== "none" ? acodec : undefined,
        formatId: String(f.format_id),
        ext: String(f.ext || ""),
        filesize:
          typeof f.filesize === "number"
            ? f.filesize
            : typeof f.filesize_approx === "number"
              ? f.filesize_approx
              : undefined,
        url: typeof f.url === "string" ? f.url : undefined,
      });
    }

    // Dedupe by quality keeping highest bitrate
    const byQuality = new Map<string, MediaVariant>();
    for (const v of variants) {
      const prev = byQuality.get(v.quality);
      if (!prev || (v.bitrate || 0) > (prev.bitrate || 0)) byQuality.set(v.quality, v);
    }
    const unique = [...byQuality.values()].sort(
      (a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0)
    );

    if (!unique.length) {
      unique.push({ id: "best", quality: "Best Available", formatId: "bv*+ba/b" });
    } else {
      unique.unshift({ id: "best", quality: "Best Available", formatId: "bv*+ba/b" });
    }

    const urlLower = url.toLowerCase();
    const streamType: StreamType = urlLower.includes(".m3u8")
      ? "hls"
      : urlLower.includes(".mpd")
        ? "dash"
        : "progressive";

    const previewCandidate =
      unique.find((v) => v.url && v.height && v.height <= 720)?.url ||
      unique.find((v) => v.url)?.url;

    return {
      ok: true,
      title: String(entry.title || "Untitled"),
      duration: typeof entry.duration === "number" ? entry.duration : undefined,
      thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : undefined,
      extractor: typeof entry.extractor === "string" ? entry.extractor : undefined,
      webpageUrl: typeof entry.webpage_url === "string" ? entry.webpage_url : url,
      variants: unique.slice(0, 24),
      previewUrl: previewCandidate,
      streamType,
    };
  } catch (err) {
    return {
      ok: false,
      variants: [],
      streamType: url.toLowerCase().includes(".m3u8")
        ? "hls"
        : url.toLowerCase().includes(".mpd")
          ? "dash"
          : "unknown",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function toMediaItems(
  pageUrl: string,
  embeds: RawEmbed[],
  options?: { probeLimit?: number }
): Promise<MediaItem[]> {
  const limit = options?.probeLimit ?? 12;
  const items: MediaItem[] = [];

  for (let i = 0; i < embeds.length; i++) {
    const emb = embeds[i];
    const probe = i < limit ? await probeWithYtDlp(emb.url) : null;
    const streamType: StreamType = emb.url.toLowerCase().includes(".m3u8")
      ? "hls"
      : emb.url.toLowerCase().includes(".mpd")
        ? "dash"
        : probe?.streamType || "unknown";

    items.push({
      id: nanoid(10),
      title: probe?.title || emb.host || "Embedded media",
      sourcePage: pageUrl,
      pageUrl,
      mediaUrl: emb.url,
      thumbnail: probe?.thumbnail,
      duration: probe?.duration,
      type: "video",
      streamType,
      extractor: probe?.extractor,
      host: emb.host,
      sources: emb.sources,
      previewUrl: probe?.previewUrl,
      variants: probe?.ok
        ? probe.variants
        : [
            { id: "best", quality: "Best Available", formatId: "bv*+ba/b" },
            { id: "direct", quality: "Direct URL", url: emb.url },
          ],
      ytdlpCompatible: Boolean(probe?.ok),
      probeError: probe?.ok === false ? probe.error : undefined,
    });
  }

  return items;
}
