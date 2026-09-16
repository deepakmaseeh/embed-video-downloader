/** Shared frontend types (mirror of API). */

export type StreamType = "progressive" | "hls" | "dash" | "unknown";

export interface MediaVariant {
  id: string;
  quality: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  videoCodec?: string;
  audioCodec?: string;
  formatId?: string;
  ext?: string;
  filesize?: number;
  url?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  sourcePage: string;
  pageUrl: string;
  mediaUrl: string;
  thumbnail?: string;
  duration?: number;
  type: "video" | "audio";
  streamType: StreamType;
  extractor?: string;
  host: string;
  sources: string[];
  previewUrl?: string;
  variants: MediaVariant[];
  ytdlpCompatible: boolean;
  probeError?: string;
  lessonId?: string;
  courseTitle?: string;
  instructor?: string;
  hasTranscript?: boolean;
  hasOutline?: boolean;
  vimeoId?: string;
}

export interface AnalyzeResult {
  id: string;
  pageUrl: string;
  status: "queued" | "running" | "completed" | "failed";
  stage?: string;
  error?: string;
  media: MediaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DownloadJob {
  id: string;
  mediaId: string;
  title: string;
  sourcePage: string;
  mediaUrl: string;
  quality: string;
  format: string;
  formatId?: string;
  status: string;
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
  filename?: string;
  filepath?: string;
  filesize?: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  transcriptFilename?: string;
  autoSaved?: boolean;
}

export interface AppSettings {
  defaultQuality: string;
  defaultFormat: string;
  filenameTemplate: string;
  autoSaveCompleted?: boolean;
  maxConcurrentDownloads?: number;
  autoBrowserSave?: boolean;
}
