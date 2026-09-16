import type { Metadata } from "next";
import { DownloadWatcher } from "../components/DownloadWatcher";
import { NavLinks } from "../components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embed Video Downloader",
  description: "Analyze pages, preview embeds, download media",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DownloadWatcher />
        <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Downloader</p>
              <h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">
                Embed Video Platform
              </h1>
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
