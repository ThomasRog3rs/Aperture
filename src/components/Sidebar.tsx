"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Aperture, Home, Tv, Film, Settings, HelpCircle, Shield } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const navItems = [
    { label: "Home", href: "/", icon: Home, isActive: pathname === "/" && !typeParam },
    { label: "TV Shows", href: "/?type=series", icon: Tv, isActive: typeParam === "series" },
    { label: "Movies", href: "/?type=movies", icon: Film, isActive: typeParam === "movies" },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background sm:flex">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Aperture className="h-5 w-5" />
        </div>
        <span className="font-sans text-xl font-bold tracking-tight text-foreground">Aperture</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted mb-2">Menu</p>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                item.isActive
                  ? "bg-accent-muted text-accent"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted mb-2">Settings</p>
          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/settings"
                ? "bg-accent-muted text-accent"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Change Path
          </Link>
        </div>
      </div>

      <div className="p-6">
        <p className="text-xs text-faint">Aperture v1.0</p>
      </div>
    </aside>
  );
}
