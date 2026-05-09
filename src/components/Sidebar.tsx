"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Aperture, Home, Tv, Film, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "sidebar-open";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : false;
  });

  const toggle = () => {
    setIsOpen((prev) => {
      localStorage.setItem(STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  const navItems = [
    { label: "Home", href: "/", icon: Home, isActive: pathname === "/" && !typeParam },
    { label: "TV Shows", href: "/?type=series", icon: Tv, isActive: typeParam === "series" },
    { label: "Movies", href: "/?type=movies", icon: Film, isActive: typeParam === "movies" },
  ];

  const labelClass = `whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out ${
    isOpen ? "max-w-[12rem] opacity-100" : "max-w-0 opacity-0"
  }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden sm:flex flex-col border-r border-border bg-background transition-[width] duration-300 ease-in-out overflow-hidden ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      <div className={`flex h-20 items-center px-4 ${isOpen ? "gap-3" : "justify-center"}`}>
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
              className={`mx-2 flex items-center rounded-lg py-2 px-3 text-sm font-medium transition-[color,background-color] ${
                isOpen ? "justify-start gap-3" : "justify-center"
              } ${
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
            className={`mx-2 flex items-center rounded-lg py-2 px-3 text-sm font-medium transition-[color,background-color] ${
              isOpen ? "justify-start gap-3" : "justify-center"
            } ${
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

      <div className={`border-t border-border flex flex-col ${isOpen ? "items-start px-4 py-4 gap-3" : "items-center py-4 gap-3"}`}>
        <p className={`text-xs text-faint ${labelClass}`}>Aperture v1.0</p>
        <button
          onClick={toggle}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="flex items-center justify-center rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
        >
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
