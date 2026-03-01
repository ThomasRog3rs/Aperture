"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Folder, RefreshCw } from "lucide-react";
import { StatusBanner } from "@/components/StatusBanner";

type SettingsResponse = {
  libraryRootPath: string | null;
};

type SyncSummary = {
  scanned: number;
  updated: number;
  notFound: number;
  errors: number;
};

export default function SettingsPage() {
  const [libraryRootPath, setLibraryRootPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: SettingsResponse) => {
        setLibraryRootPath(data.libraryRootPath ?? "");
      })
      .catch(() => {
        setNotice({ tone: "error", message: "Failed to load settings." });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryRootPath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }
      setNotice({ tone: "success", message: "Library path saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = (await response.json()) as SyncSummary & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync library.");
      }
      setNotice({
        tone: data.errors > 0 ? "error" : "success",
        message: `Synced ${data.updated} movies (${data.notFound} not found, ${data.errors} errors).`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to sync library.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Library Settings
              </h1>
              <p className="text-sm text-muted">
                Point Aperture at your local movie library.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <label className="text-xs font-medium uppercase tracking-[0.2em] text-faint">
              Library path
            </label>
            <input
              value={libraryRootPath}
              onChange={(event) => setLibraryRootPath(event.target.value)}
              placeholder="/Volumes/Expansion/My Movies"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
            />
            <p className="text-xs text-faint">
              Example: /Volumes/Expansion/My Movies
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save path"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm text-muted transition-colors hover:border-border-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync Library"}
            </button>
          </div>

          <div className="mt-6">
            {notice ? (
              <StatusBanner tone={notice.tone} message={notice.message} />
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <p className="font-serif font-medium text-foreground">
            Tips for better matches
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted marker:text-accent/40">
            <li>
              Keep folder names focused on title + year (e.g. The_Godfather_1972)
            </li>
            <li>
              The cleaner removes tags like 1080p, x264, BluRay, REPACK, etc.
            </li>
            <li>
              If a movie isn&apos;t found, it will still appear with a
              &quot;Not found&quot; badge.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
