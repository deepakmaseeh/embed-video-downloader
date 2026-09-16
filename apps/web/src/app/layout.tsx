import type { Metadata } from "next";
import Link from "next/link";
import { DownloadWatcher } from "../components/DownloadWatcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embed Video Downloader",
  description: "Analyze pages, preview embeds, download media",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/results", label: "Results" },
  { href: "/downloads", label: "Downloads" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

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
            <nav className="hidden gap-2 md:flex">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="btn-ghost">
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[rgba(255,252,247,0.95)] backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1 px-2 py-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-1 py-2 text-center text-[11px] font-semibold text-stone-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
