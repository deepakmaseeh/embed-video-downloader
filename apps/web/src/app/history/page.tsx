"use client";

import { useEffect, useState } from "react";
import { api, type HistoryEntryLike } from "../../lib/api";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntryLike[]>([]);

  useEffect(() => {
    api.history().then((h) => setHistory(h.history || [])).catch(() => undefined);
  }, []);

  return (
    <main className="space-y-4">
      <h2 className="display text-2xl font-bold">History</h2>
      {!history.length ? (
        <div className="panel p-6 text-sm text-stone-600">No completed downloads yet.</div>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{h.title}</p>
                <p className="text-xs text-stone-500">
                  {h.quality} · {h.format} · {new Date(h.createdAt).toLocaleString()}
                </p>
              </div>
              <a className="btn-ghost" href={api.fileUrl(h.filename)}>
                {h.filename}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
