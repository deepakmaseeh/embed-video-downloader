"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/results", label: "Course" },
  { href: "/downloads", label: "Queue" },
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
      <nav className="hidden flex-wrap gap-1.5 md:flex" aria-label="Main">
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
    <nav className="mobile-nav fixed inset-x-0 bottom-0 z-40 md:hidden" aria-label="Main">
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
                  ? "rounded-xl bg-teal-500/20 px-1 py-2.5 text-center text-[11px] font-bold text-teal-200 ring-1 ring-teal-400/30"
                  : "rounded-xl px-1 py-2.5 text-center text-[11px] font-semibold text-teal-100/55"
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
