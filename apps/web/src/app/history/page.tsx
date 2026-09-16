"use client";

import { useEffect, useState } from "react";
import {
  clearLocalHistory,
  getLocalHistory,
  removeLocalHistory,
  type LocalHistoryEntry,
} from "../../lib/localStore";

export default function HistoryPage() {
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getLocalHistory());
  }, []);

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-2xl font-bold">History</h2>
          <p className="text-sm text-stone-500">
            Stored in this browser only (localStorage). Other visitors cannot see it.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              clearLocalHistory();
              setHistory([]);
            }}
          >
            Clear history
          </button>
        )}
      </div>
      {!history.length ? (
        <div className="panel p-6 text-sm text-stone-600">No completed downloads yet in this browser.</div>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{h.title}</p>
                <p className="text-xs text-stone-500">
                  {h.quality} · {h.format} · {h.filename} ·{" "}
                  {new Date(h.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setHistory(removeLocalHistory(h.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
