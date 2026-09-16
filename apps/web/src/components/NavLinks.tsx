"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/results", label: "Results" },
  { href: "/downloads", label: "Downloads" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname() || "/";

  if (variant === "desktop") {
    return (
      <nav className="hidden gap-2 md:flex" aria-label="Main">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={active ? "btn-nav-active" : "btn-ghost"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[rgba(255,252,247,0.95)] backdrop-blur md:hidden"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1 px-2 py-2">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-lg bg-teal-700 px-1 py-2 text-center text-[11px] font-bold text-white"
                  : "rounded-lg px-1 py-2 text-center text-[11px] font-semibold text-stone-700"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
