/**
 * BiblicalTraining.org site extractor
 * Strategy (same as Aditya0320/Video-Downloader):
 *   page (__NEXT_DATA__) → JSON:API lesson → Vimeo oEmbed → player config / yt-dlp
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { MediaItem, MediaVariant } from "../types";
import { curlBinary } from "./ytDlpCmd";

const execFileAsync = promisify(execFile);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function isBiblicalTrainingUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "").includes("biblicaltraining.org");
  } catch {
    return false;
  }
}

async function fetchHtmlCurl(url: string): Promise<string> {
  // curl often passes Cloudflare where Node fetch gets 403
  const { stdout } = await execFileAsync(
    curlBinary(),
    ["-sL", "-A", UA, "--max-time", "45", url],
    { encoding: "utf8", maxBuffer: 25 * 1024 * 1024, windowsHide: true }
  );
  if (!stdout || stdout.length < 200) {
    throw new Error("Empty response from BiblicalTraining page (curl)");
  }
  // Real BT pages include __NEXT_DATA__. Challenge interstitials do not.
  if (!/id=["']__NEXT_DATA__["']/i.test(stdout)) {
    if (/cf-browser-verification|challenge-platform|cdn-cgi\/challenge|just a moment/i.test(stdout)) {
      throw new Error("Cloudflare challenge page returned — try again shortly");
    }
    throw new Error("BiblicalTraining page did not include course data (__NEXT_DATA__ missing)");
  }
  return stdout;
}

async function fetchHtmlNode(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching BiblicalTraining page`);
  return res.text();
}

export async function fetchBiblicalTrainingHtml(url: string): Promise<string> {
  try {
    return await fetchHtmlCurl(url);
  } catch (err) {
    try {
      return await fetchHtmlNode(url);
    } catch {
      throw err;
    }
  }
}

function parseNextData(html: string): Record<string, unknown> {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    throw new Error("Could not find __NEXT_DATA__ on page (not a BiblicalTraining Next.js page?)");
  }
  return JSON.parse(match[1]) as Record<string, unknown>;
}

interface LessonRef {
  id: string;
  title: string;
  lessonNumber: number;
  slug?: string;
}

function collectLessonsFromNextData(nextData: Record<string, unknown>): {
  courseTitle: string;
  instructor: string;
  lessons: LessonRef[];
} {
  const pageProps = (nextData.props as Record<string, unknown> | undefined)?.pageProps as
    | Record<string, unknown>
    | undefined;

  if (!pageProps) {
    throw new Error("No pageProps in __NEXT_DATA__");
  }

  const classNode = pageProps.classNode as Record<string, unknown> | undefined;
  if (classNode) {
    const rawLessons = (classNode.field_lessons as Record<string, unknown>[]) || [];
    const professors = (classNode.field_professors as Record<string, unknown>[]) || [];
    return {
      courseTitle: String(classNode.title || "BiblicalTraining Course").trim(),
      instructor: String(professors[0]?.title || "BiblicalTraining").trim(),
      lessons: rawLessons.map((item, idx) => ({
        id: String(item.id),
        title: String(item.title || `Lesson ${idx + 1}`).trim(),
        lessonNumber:
          item.field_lesson_number !== undefined && item.field_lesson_number !== null
            ? Number(item.field_lesson_number)
            : idx,
        slug: item.bt_router_slug ? String(item.bt_router_slug) : undefined,
      })),
    };
  }

  // Single lesson page variants
  const lessonNode =
    (pageProps.lessonNode as Record<string, unknown> | undefined) ||
    (pageProps.node as Record<string, unknown> | undefined) ||
    (pageProps.lesson as Record<string, unknown> | undefined);

  if (lessonNode?.id && (lessonNode.type === "node--lesson" || String(lessonNode.type || "").includes("lesson") || lessonNode.title)) {
    return {
      courseTitle: String(pageProps.courseTitle || lessonNode.title || "BiblicalTraining Lesson").trim(),
      instructor: "BiblicalTraining",
      lessons: [
        {
          id: String(lessonNode.id),
          title: String(lessonNode.title || "Lesson").trim(),
          lessonNumber: Number(lessonNode.field_lesson_number ?? 1),
          slug: lessonNode.bt_router_slug ? String(lessonNode.bt_router_slug) : undefined,
        },
      ],
    };
  }

  // Deep search for lesson UUID + title pairs in JSON
  const found: LessonRef[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown, depth = 0) => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const type = String(obj.type || "");
    const id = obj.id ? String(obj.id) : "";
    if (
      id &&
      !seen.has(id) &&
      (type.includes("lesson") || obj.field_lesson_number !== undefined || obj.bt_router_slug)
    ) {
      // Prefer UUID-looking ids from Drupal JSON:API
      if (/^[0-9a-f-]{36}$/i.test(id) || type.includes("lesson")) {
        seen.add(id);
        found.push({
          id,
          title: String(obj.title || `Lesson ${found.length + 1}`).trim(),
          lessonNumber: Number(obj.field_lesson_number ?? found.length + 1),
          slug: obj.bt_router_slug ? String(obj.bt_router_slug) : undefined,
        });
      }
    }
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  walk(pageProps);

  if (found.length) {
    return {
      courseTitle: String(pageProps.title || "BiblicalTraining").trim(),
      instructor: "BiblicalTraining",
      lessons: found,
    };
  }

  throw new Error(
    "No course/lesson data found. Use a BiblicalTraining course overview URL, or an active lesson page."
  );
}

async function resolveLessonVideo(lessonId: string): Promise<{
  vimeoUrl: string | null;
  vimeoId: string | null;
  thumbnail?: string;
  hasTranscript: boolean;
  hasOutline: boolean;
}> {
  const apiUrl = `https://back.biblicaltraining.org/jsonapi/node/lesson/${lessonId}?include=field_video`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": UA, Accept: "application/vnd.api+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    return { vimeoUrl: null, vimeoId: null, hasTranscript: false, hasOutline: false };
  }
  const apiJson = (await res.json()) as {
    included?: Array<{ type?: string; attributes?: Record<string, unknown> }>;
    data?: { attributes?: Record<string, unknown> };
  };

  let vimeoUrl: string | null = null;
  let vimeoId: string | null = null;
  let thumbnail: string | undefined;

  if (apiJson.included) {
    const videoItem = apiJson.included.find((x) => x.type === "media--video");
    const oembed = videoItem?.attributes?.field_media_oembed_video;
    if (typeof oembed === "string") {
      vimeoUrl = oembed;
      const match = oembed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (match) vimeoId = match[1];
    }
    const thumb =
      videoItem?.attributes?.thumbnail_uri ||
      videoItem?.attributes?.field_media_image ||
      undefined;
    if (typeof thumb === "string") thumbnail = thumb;
  }

  const attrs = apiJson.data?.attributes;
  const transcriptVal = (attrs?.field_transcript as { value?: string } | undefined)?.value;
  const outlineVal = (attrs?.field_outline as { value?: string } | undefined)?.value;
  return {
    vimeoUrl,
    vimeoId,
    thumbnail,
    hasTranscript: Boolean(transcriptVal),
    hasOutline: Boolean(outlineVal),
  };
}

function cleanHtmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\uFFFD/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 180);
}

/** Save outline + transcript as .txt (same style as Aditya0320/Video-Downloader). */
export async function downloadBiblicalTrainingTranscript(options: {
  lessonId: string;
  title: string;
  courseTitle?: string;
  instructor?: string;
  outDir: string;
}): Promise<{ filename: string; filepath: string; bytes: number } | null> {
  const apiUrl = `https://back.biblicaltraining.org/jsonapi/node/lesson/${options.lessonId}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": UA, Accept: "application/vnd.api+json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: { attributes?: Record<string, unknown> };
  };
  const attrs = json.data?.attributes || {};
  const transcriptHtml = (attrs.field_transcript as { value?: string } | undefined)?.value || "";
  const outlineHtml = (attrs.field_outline as { value?: string } | undefined)?.value || "";
  if (!transcriptHtml && !outlineHtml) return null;

  const cleanOutline = cleanHtmlToText(outlineHtml);
  const cleanTranscript = cleanHtmlToText(transcriptHtml);

  let content = `================================================================================\n`;
  content += `COURSE: ${options.courseTitle || "BiblicalTraining"}\n`;
  content += `LESSON: ${options.title}\n`;
  if (options.instructor) content += `INSTRUCTOR: ${options.instructor}\n`;
  content += `================================================================================\n\n`;

  if (cleanOutline) {
    content += `--------------------------------------------------------------------------------\n`;
    content += `LESSON OUTLINE\n`;
    content += `--------------------------------------------------------------------------------\n\n`;
    content += `${cleanOutline}\n\n`;
  }
  if (cleanTranscript) {
    content += `--------------------------------------------------------------------------------\n`;
    content += `TRANSCRIPT\n`;
    content += `--------------------------------------------------------------------------------\n\n`;
    content += `${cleanTranscript}\n`;
  }

  const fs = await import("fs");
  const path = await import("path");
  fs.mkdirSync(options.outDir, { recursive: true });
  const filename = `${sanitizeFilename(options.title)}.txt`;
  const filepath = path.join(options.outDir, filename);
  fs.writeFileSync(filepath, content, "utf8");
  return { filename, filepath, bytes: Buffer.byteLength(content, "utf8") };
}

export async function getVimeoHlsUrl(vimeoId: string): Promise<string> {
  const configUrl = `https://player.vimeo.com/video/${vimeoId}/config`;
  const res = await fetch(configUrl, {
    headers: {
      Referer: "https://www.biblicaltraining.org/",
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`Vimeo player config failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    request?: { files?: { hls?: { default_cdn?: string; cdns?: Record<string, { url?: string }> } } };
  };
  const hls = data.request?.files?.hls;
  if (!hls?.cdns) throw new Error("No HLS stream in Vimeo configuration");
  const cdn = hls.default_cdn || Object.keys(hls.cdns)[0];
  const hlsUrl = hls.cdns[cdn]?.url;
  if (!hlsUrl) throw new Error(`No HLS URL for CDN ${cdn}`);
  return hlsUrl;
}

function qualityVariants(vimeoId: string): MediaVariant[] {
  return [
    { id: "best", quality: "Best Available", formatId: "bestvideo*+bestaudio/best" },
    {
      id: "1080",
      quality: "1080p",
      height: 1080,
      formatId: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    },
    {
      id: "720",
      quality: "720p",
      height: 720,
      formatId: "bestvideo[height<=720]+bestaudio/best[height<=720]",
    },
    {
      id: "480",
      quality: "480p",
      height: 480,
      formatId: "bestvideo[height<=480]+bestaudio/best[height<=480]",
    },
  ].map((v) => ({ ...v, ext: "mp4" }));
}

export async function analyzeBiblicalTraining(
  pageUrl: string,
  onStage?: (stage: string) => void
): Promise<MediaItem[]> {
  onStage?.("BiblicalTraining: fetching page (curl)");
  const html = await fetchBiblicalTrainingHtml(pageUrl);
  onStage?.("BiblicalTraining: parsing __NEXT_DATA__");
  const nextData = parseNextData(html);
  const { courseTitle, instructor, lessons } = collectLessonsFromNextData(nextData);

  if (!lessons.length) {
    throw new Error("No lessons found on this BiblicalTraining page");
  }

  onStage?.(`BiblicalTraining: resolving ${lessons.length} lesson(s) via JSON:API`);
  const chunkSize = 10;
  const media: MediaItem[] = [];

  for (let i = 0; i < lessons.length; i += chunkSize) {
    const chunk = lessons.slice(i, i + chunkSize);
    onStage?.(
      `BiblicalTraining: fetching videos ${i + 1}–${Math.min(i + chunkSize, lessons.length)} of ${lessons.length}`
    );
    const resolved = await Promise.all(
      chunk.map(async (lesson) => {
        const video = await resolveLessonVideo(lesson.id);
        if (!video.vimeoId) return null;

        const vimeoPage = `https://vimeo.com/${video.vimeoId}`;
        const title =
          lessons.length > 1
            ? `${String(lesson.lessonNumber).padStart(2, "0")} — ${lesson.title}`
            : lesson.title;

        const item: MediaItem = {
          id: nanoid(10),
          title,
          sourcePage: pageUrl,
          pageUrl,
          mediaUrl: vimeoPage,
          thumbnail: video.thumbnail,
          type: "video",
          streamType: "hls",
          extractor: "biblicaltraining+vimeo",
          host: "vimeo.com",
          sources: ["biblicaltraining-jsonapi", "vimeo"],
          previewUrl: `https://player.vimeo.com/video/${video.vimeoId}`,
          variants: qualityVariants(video.vimeoId),
          ytdlpCompatible: true,
          lessonId: lesson.id,
          courseTitle,
          instructor,
          hasTranscript: video.hasTranscript || video.hasOutline,
          hasOutline: video.hasOutline,
          vimeoId: video.vimeoId,
        };
        return item;
      })
    );

    for (const item of resolved) {
      if (item) media.push(item);
    }
  }

  if (!media.length) {
    throw new Error(
      `Found ${lessons.length} lesson(s) in "${courseTitle}" but no Vimeo videos via API (may require login).`
    );
  }

  return media;
}
