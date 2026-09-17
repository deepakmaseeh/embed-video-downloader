import type { Metadata } from "next";
import { DownloadWatcher } from "../components/DownloadWatcher";
import { NavLinks } from "../components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embed Video Downloader",
  description: "Analyze courses & pages, preview embeds, download video + transcripts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DownloadWatcher />
        <div className="relative mx-auto min-h-screen w-full max-w-6xl px-3 pb-28 pt-5 sm:px-6 sm:pt-7">
          <header className="panel mb-5 flex flex-col gap-4 p-4 sm:mb-7 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-400 text-white shadow-lg shadow-teal-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300/90">Universal Downloader</p>
                <h1 className="display truncate text-xl font-extrabold text-white sm:text-2xl">
                  Video & Transcript Platform
                </h1>
                <p className="hidden text-xs text-teal-100/50 sm:block">
                  Course pages · embeds · 1080p streams · .txt transcripts
                </p>
              </div>
            </div>
            <NavLinks variant="desktop" />
          </header>
          {children}
          <NavLinks variant="mobile" />
        </div>
      </body>
    </html>
  );
}
