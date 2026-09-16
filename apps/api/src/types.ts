export type StreamType = "progressive" | "hls" | "dash" | "unknown";
export type MediaType = "video" | "audio";

export type DownloadStatus =
  | "queued"
  | "preparing"
  | "downloading"
  | "processing"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

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
  type: MediaType;
  streamType: StreamType;
  extractor?: string;
  host: string;
  sources: string[];
  previewUrl?: string;
  variants: MediaVariant[];
  ytdlpCompatible: boolean;
  probeError?: string;
  /** BiblicalTraining / site extras */
  lessonId?: string;
  courseTitle?: string;
  instructor?: string;
  hasTranscript?: boolean;
  hasOutline?: boolean;
  vimeoId?: string;
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
  status: DownloadStatus;
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
  lessonId?: string;
  includeTranscript?: boolean;
  transcriptFilename?: string;
  transcriptOnly?: boolean;
  autoSaved?: boolean;
}

export interface AppSettings {
  defaultQuality: string;
  defaultFormat: string;
  filenameTemplate: string;
  /** Copy finished files into downloads/completed/ when a job finishes */
  autoSaveCompleted?: boolean;
  /** How many downloads may run at once (others stay queued) */
  maxConcurrentDownloads?: number;
  /** Frontend: trigger browser save when a job completes */
  autoBrowserSave?: boolean;
}
