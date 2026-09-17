"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AppSettings } from "../../lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    defaultQuality: "Best Available",
    defaultFormat: "mp4",
    filenameTemplate: "{index}_{title}_{quality}",
    autoSaveCompleted: true,
    maxConcurrentDownloads: 2,
    autoBrowserSave: true,
  });
  const [storage, setStorage] = useState<{
    usedBytes: number;
    fileCount: number;
    downloadDir: string;
    completedDir?: string;
  } | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api.settings().then((s) => setSettings((prev) => ({ ...prev, ...s }))).catch(() => undefined);
    api.storage().then(setStorage).catch(() => undefined);
  }, []);

  return (
    <main className="space-y-4">
      <h2 className="display text-2xl font-extrabold text-white">Settings</h2>
      <section className="panel space-y-4 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal-200/45">
            Default quality
          </span>
          <input
            className="input"
            value={settings.defaultQuality}
            onChange={(e) => setSettings({ ...settings, defaultQuality: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal-200/45">
            Default format
          </span>
          <select
            className="input"
            value={settings.defaultFormat}
            onChange={(e) => setSettings({ ...settings, defaultFormat: e.target.value })}
          >
            {["mp4", "webm", "mkv", "mp3", "m4a", "wav"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal-200/45">
            Filename template
          </span>
          <input
            className="input"
            value={settings.filenameTemplate}
            onChange={(e) => setSettings({ ...settings, filenameTemplate: e.target.value })}
          />
          <span className="mt-1 block text-xs text-teal-100/40">
            Tokens: {"{index} {title} {quality} {format} {date} {source}"}
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <input
            type="checkbox"
            checked={settings.autoSaveCompleted !== false}
            onChange={(e) => setSettings({ ...settings, autoSaveCompleted: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-white">Keep auto-save on complete</span>
            <span className="block text-xs text-teal-100/45">
              Copy finished files to downloads/completed/ without stopping other downloads
            </span>
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <input
            type="checkbox"
            checked={settings.autoBrowserSave !== false}
            onChange={(e) => setSettings({ ...settings, autoBrowserSave: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-white">Browser save when complete</span>
            <span className="block text-xs text-teal-100/45">
              Finished files download to this device; history stays in localStorage
            </span>
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal-200/45">
            Max concurrent downloads
          </span>
          <input
            className="input"
            type="number"
            min={1}
            max={6}
            value={settings.maxConcurrentDownloads ?? 2}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxConcurrentDownloads: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
              })
            }
          />
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            await api.patchSettings(settings);
            setSaved("Saved");
            setTimeout(() => setSaved(""), 1500);
          }}
        >
          Save settings
        </button>
        {saved && <p className="text-sm text-teal-300">{saved}</p>}
      </section>

      {storage && (
        <section className="panel p-5">
          <h3 className="font-semibold text-white">Server temp storage</h3>
          <p className="mt-2 text-sm text-teal-100/55">
            {storage.fileCount} temp files · {(storage.usedBytes / (1024 * 1024)).toFixed(1)} MB (processed on the
            server, then sent to each visitor&apos;s browser)
          </p>
          <p className="mt-2 text-xs text-teal-100/40">
            Recent URLs and download history are <strong className="text-teal-100">not</strong> shared — they stay in
            each browser&apos;s localStorage.
          </p>
        </section>
      )}
    </main>
  );
}
