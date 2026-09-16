"use client";

import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { DownloadJob } from "../lib/types";
import {
  getAutoBrowserSave,
  markJobBrowserSaved,
  pushLocalHistory,
  wasJobBrowserSaved,
} from "../lib/localStore";

function triggerBrowserSave(filename: string) {
  const a = document.createElement("a");
  a.href = api.fileUrl(filename, true);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function recordHistory(job: DownloadJob, filename: string, format?: string, quality?: string) {
  pushLocalHistory({
    id: `${job.id}:${filename}`,
    title: job.title,
    sourcePage: job.sourcePage,
    filename,
    quality: quality || job.quality,
    format: format || job.format,
    status: "completed",
    filesize: job.filesize,
    createdAt: job.updatedAt || new Date().toISOString(),
  });
}

/** Runs on every page: saves finished files to this browser + local history only. */
export function DownloadWatcher() {
  const connected = useRef(false);

  useEffect(() => {
    if (connected.current) return;
    connected.current = true;

    const es = new EventSource(api.eventsUrl());
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type !== "download" || !payload.job) return;
        const job = payload.job as DownloadJob;
        if (job.status !== "completed" || !job.filename) return;
        if (wasJobBrowserSaved(job.id)) return;
        if (!getAutoBrowserSave()) {
          recordHistory(job, job.filename);
          if (job.transcriptFilename && job.transcriptFilename !== job.filename) {
            recordHistory(job, job.transcriptFilename, "txt", "transcript");
          }
          markJobBrowserSaved(job.id);
          return;
        }

        markJobBrowserSaved(job.id);
        triggerBrowserSave(job.filename);
        recordHistory(job, job.filename);
        if (job.transcriptFilename && job.transcriptFilename !== job.filename) {
          setTimeout(() => {
            triggerBrowserSave(job.transcriptFilename!);
            recordHistory(job, job.transcriptFilename!, "txt", "transcript");
          }, 500);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      es.close();
      connected.current = false;
    };
  }, []);

  return null;
}
