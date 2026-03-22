"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Aperture, Home, Tv, Film, Settings } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const navItems = [
    { label: "Home", href: "/", icon: Home, isActive: pathname === "/" && !typeParam },
    { label: "TV Shows", href: "/?type=series", icon: Tv, isActive: typeParam === "series" },
    { label: "Movies", href: "/?type=movies", icon: Film, isActive: typeParam === "movies" },
  ];

  const labelClass =
    "whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[12rem] transition-[max-width] duration-300 ease-in-out opacity-0 group-hover:opacity-100";

  return (
    <aside className="group fixed inset-y-0 left-0 z-40 hidden sm:flex w-16 hover:w-64 flex-col border-r border-border bg-background transition-[width] duration-300 ease-in-out overflow-hidden">
      <div className="flex h-20 items-center gap-3 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <Aperture className="h-5 w-5" />
        </div>
        <span className={`font-sans text-xl font-bold tracking-tight text-foreground ${labelClass}`}>
          Aperture
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6">
        <div className="space-y-1">
          <p className={`px-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2 ${labelClass}`}>
            Menu
          </p>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`mx-2 flex items-center gap-3 rounded-lg py-2 group-hover:px-3 text-sm font-medium transition-[padding,color,background-color] justify-center group-hover:justify-start ${
                item.isActive
                  ? "bg-accent-muted text-accent"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={labelClass}>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-1">
          <p className={`px-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2 ${labelClass}`}>
            Settings
          </p>
          <Link
            href="/settings"
            className={`mx-2 flex items-center gap-3 rounded-lg py-2 group-hover:px-3 text-sm font-medium transition-[padding,color,background-color] justify-center group-hover:justify-start ${
              pathname === "/settings"
                ? "bg-accent-muted text-accent"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={labelClass}>Change Path</span>
          </Link>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className={`text-xs text-faint ${labelClass}`}>Aperture v1.0</p>
      </div>
    </aside>
  );
}
