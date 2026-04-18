"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Folder,
  Loader2,
  RefreshCw,
  Shield,
  Tv,
  Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type StepId = 1 | 2 | 3 | 4 | 5 | 6;

type WizardState = {
  libraryRootPath: string;
  omdbApiKey: string;
  playerMode: "browser" | "external";
  magnetApiEnabled: boolean;
  magnetApiBaseUrl: string;
};

type OmdbValidation = "idle" | "validating" | "valid" | "invalid";
type MagnetCheck = { checked: boolean; docker: boolean; python: boolean; recommendation: string };

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: StepId; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as StepId;
        const done = step < current;
        const active = step === current;
        return (
          <div
            key={step}
            className={`rounded-full transition-all duration-300 ${
              active
                ? "w-6 h-2 bg-accent"
                : done
                ? "w-2 h-2 bg-accent/60"
                : "w-2 h-2 bg-surface-strong"
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Reusable input ─────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  error,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  error?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 rounded-lg border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint outline-none focus:ring-1 transition-colors ${
            error
              ? "border-error focus:ring-error"
              : "border-border focus:ring-accent focus:border-accent"
          }`}
        />
        {right}
      </div>
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [saving, setSaving] = useState(false);
  const [syncStarted, setSyncStarted] = useState(false);
  const syncDoneRef = useRef(false);

  const [state, setState] = useState<WizardState>({
    libraryRootPath: "",
    omdbApiKey: "",
    playerMode: "browser",
    magnetApiEnabled: false,
    magnetApiBaseUrl: "http://localhost:8000",
  });

  const [omdbValidation, setOmdbValidation] = useState<OmdbValidation>("idle");
  const [omdbError, setOmdbError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [magnetCheck, setMagnetCheck] = useState<MagnetCheck>({
    checked: false,
    docker: false,
    python: false,
    recommendation: "none",
  });

  // Check if setup is already done — if so, redirect immediately.
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data: { completed: boolean }) => {
        if (data.completed) {
          document.cookie = "aperture_setup_done=1; path=/; max-age=31536000";
          router.replace("/");
        }
      })
      .catch(() => {});
  }, [router]);

  const update = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
      setState((prev) => ({ ...prev, [key]: value })),
    []
  );

  // ── Step validation ─────────────────────────────────────────────────────────
  const canAdvance: Record<StepId, boolean> = {
    1: true,
    2: state.libraryRootPath.trim().length > 0 && !pathError,
    3: omdbValidation === "valid",
    4: true,
    5: true,
    6: true,
  };

  // ── Path validation ─────────────────────────────────────────────────────────
  const validatePath = useCallback(async (path: string) => {
    setPathError(null);
    if (!path.trim()) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryRootPath: path }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setPathError(data.error ?? "Invalid path.");
      }
    } catch {
      setPathError("Could not reach the server.");
    }
  }, []);

  const validateOmdb = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setOmdbValidation("validating");
    setOmdbError(null);
    try {
      const res = await fetch("/api/setup/validate-omdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = (await res.json()) as { valid: boolean; error?: string };
      if (data.valid) {
        setOmdbValidation("valid");
      } else {
        setOmdbValidation("invalid");
        setOmdbError(data.error ?? "Invalid API key.");
      }
    } catch {
      setOmdbValidation("invalid");
      setOmdbError("Could not reach OMDb. Check your internet connection.");
    }
  }, []);

  const checkMagnetDeps = useCallback(async () => {
    try {
      const res = await fetch("/api/setup/check-magnet");
      const data = (await res.json()) as {
        docker: boolean;
        python: boolean;
        pythonCmd: string | null;
        recommendation: string;
      };
      setMagnetCheck({ checked: true, ...data });
    } catch {
      setMagnetCheck({ checked: true, docker: false, python: false, recommendation: "none" });
    }
  }, []);

  // ── Save all settings & complete setup ─────────────────────────────────────
  const completeSetup = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryRootPath: state.libraryRootPath }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ omdbApiKey: state.omdbApiKey }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerMode: state.playerMode }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magnetApiEnabled: state.magnetApiEnabled,
          magnetApiBaseUrl: state.magnetApiBaseUrl,
        }),
      });

      document.cookie = "aperture_setup_done=1; path=/; max-age=31536000";

      if (!syncDoneRef.current) {
        setSyncStarted(true);
        syncDoneRef.current = true;
        const eventSource = new EventSource("/api/sync");
        eventSource.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data) as { type: string };
            if (event.type === "complete" || event.type === "error") {
              eventSource.close();
              router.replace("/");
            }
          } catch {
            eventSource.close();
            router.replace("/");
          }
        };
        eventSource.onerror = () => {
          eventSource.close();
          router.replace("/");
        };
      }
    } catch {
      setSaving(false);
    }
  }, [state, router]);

  // ── Render helpers ──────────────────────────────────────────────────────────
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s));
  const goNext = () => setStep((s) => (s < 6 ? ((s + 1) as StepId) : s));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
          <Aperture className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Aperture</h1>
          <p className="text-xs text-muted">First-time setup</p>
        </div>
      </div>

      <StepDots current={step} total={6} />

      {/* ── Step 1: Welcome ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Aperture</h2>
            <p className="text-muted text-sm leading-relaxed">
              Aperture is your personal media library — it runs entirely on your computer.
              Nothing is uploaded anywhere. Your files stay yours.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              { icon: Shield, label: "100% local", desc: "No accounts, no cloud, no tracking." },
              { icon: Folder, label: "Your media files", desc: "Point Aperture at your existing folders." },
              { icon: Tv, label: "Movies & TV", desc: "Automatically fetches metadata for everything." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Media folder ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Where are your media files?</h2>
            <p className="text-muted text-sm leading-relaxed">
              Enter the full path to the folder that contains your movies and TV shows. Aperture will scan it automatically.
            </p>
          </div>
          <Field
            label="Media folder path"
            value={state.libraryRootPath}
            onChange={(v) => {
              update("libraryRootPath", v);
              setPathError(null);
            }}
            placeholder={
              typeof window !== "undefined" && navigator.userAgent.includes("Win")
                ? "C:\\Users\\You\\Videos"
                : "/Users/you/Movies"
            }
            error={pathError}
            hint="This can be a single root folder or a parent folder that contains separate Movies and TV subfolders."
            right={
              <button
                onClick={() => validatePath(state.libraryRootPath)}
                disabled={!state.libraryRootPath.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                Check
              </button>
            }
          />
          <p className="text-xs text-faint">
            Examples:{" "}
            <code className="text-accent/80">/Volumes/Media</code>
            {" · "}
            <code className="text-accent/80">D:\Media</code>
          </p>
        </div>
      )}

      {/* ── Step 3: OMDb API key ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">OMDb API Key</h2>
            <p className="text-muted text-sm leading-relaxed">
              Aperture uses OMDb to fetch posters, ratings, and descriptions for your media.
              A free API key gives you 1,000 requests per day — more than enough for most libraries.
            </p>
          </div>
          <Field
            label="OMDb API key"
            value={state.omdbApiKey}
            onChange={(v) => {
              update("omdbApiKey", v);
              setOmdbValidation("idle");
              setOmdbError(null);
            }}
            placeholder="xxxxxxxx"
            error={omdbError}
            hint={
              omdbValidation === "valid"
                ? undefined
                : "Paste your key here, then click Verify."
            }
            right={
              omdbValidation === "valid" ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <button
                  onClick={() => validateOmdb(state.omdbApiKey)}
                  disabled={!state.omdbApiKey.trim() || omdbValidation === "validating"}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {omdbValidation === "validating" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Verify
                </button>
              )
            }
          />
          <a
            href="https://www.omdbapi.com/apikey.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
          >
            Get a free API key at omdbapi.com
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* ── Step 4: Playback preference ─────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">How do you want to watch?</h2>
            <p className="text-muted text-sm leading-relaxed">
              Choose how Aperture opens your media files when you press Play.
            </p>
          </div>
          <div className="grid gap-3">
            {(
              [
                {
                  value: "browser" as const,
                  label: "In the browser",
                  desc: "Play videos directly in Aperture using the built-in player. No extra software needed.",
                },
                {
                  value: "external" as const,
                  label: "External player",
                  desc: "Open files with your default video player (VLC, IINA, MPC, etc.).",
                },
              ] as const
            ).map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => update("playerMode", value)}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  state.playerMode === value
                    ? "border-accent bg-accent-muted"
                    : "border-border bg-surface hover:border-border-hover"
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    state.playerMode === value ? "border-accent" : "border-border"
                  }`}
                >
                  {state.playerMode === value && (
                    <div className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 5: MagnetAPI ────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Magnet Search (optional)</h2>
            <p className="text-muted text-sm leading-relaxed">
              MagnetAPI lets you search for torrents directly from a media item&apos;s page.
              It requires Docker or Python 3.9+ to run locally. You can enable it later in Settings.
            </p>
          </div>

          <button
            onClick={() => {
              const next = !state.magnetApiEnabled;
              update("magnetApiEnabled", next);
              if (next && !magnetCheck.checked) checkMagnetDeps();
            }}
            className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
              state.magnetApiEnabled
                ? "border-accent bg-accent-muted"
                : "border-border bg-surface hover:border-border-hover"
            }`}
          >
            <div
              className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                state.magnetApiEnabled ? "border-accent bg-accent" : "border-border"
              }`}
            >
              {state.magnetApiEnabled && <Check className="h-3 w-3 text-white" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Enable MagnetAPI</p>
              <p className="text-xs text-muted mt-0.5">Adds torrent search to every movie and series page.</p>
            </div>
          </button>

          {state.magnetApiEnabled && (
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              {!magnetCheck.checked ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for Docker and Python…
                </div>
              ) : magnetCheck.recommendation === "none" ? (
                <div className="space-y-2">
                  <p className="text-sm text-warning font-medium">
                    ⚠️ Neither Docker nor Python 3.9+ was found.
                  </p>
                  <p className="text-xs text-muted">
                    MagnetAPI needs one of these to run. You can install Docker or Python and enable this later in Settings.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href="https://www.docker.com/get-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      Get Docker <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="https://www.python.org/downloads/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      Get Python <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <p className="text-sm text-success font-medium">
                      {magnetCheck.recommendation === "docker"
                        ? "Docker detected — MagnetAPI will run in a container."
                        : "Python detected — MagnetAPI will run as a local process."}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    MagnetAPI will be set up automatically when you finish.
                  </p>
                </div>
              )}

              <Field
                label="MagnetAPI base URL"
                value={state.magnetApiBaseUrl}
                onChange={(v) => update("magnetApiBaseUrl", v)}
                placeholder="http://localhost:8000"
                hint="Change this only if you run MagnetAPI on a different host or port."
              />
            </div>
          )}
        </div>
      )}

      {/* ── Step 6: Review & finish ──────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Ready to go!</h2>
            <p className="text-muted text-sm leading-relaxed">
              Review your setup, then click <strong>Finish &amp; Sync</strong>. Aperture will save your settings and scan your library in the background.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            {[
              {
                icon: Folder,
                label: "Media folder",
                value: state.libraryRootPath,
              },
              {
                icon: Shield,
                label: "OMDb API key",
                value: state.omdbApiKey ? "••••••••" + state.omdbApiKey.slice(-4) : "—",
              },
              {
                icon: Tv,
                label: "Playback",
                value: state.playerMode === "browser" ? "In the browser" : "External player",
              },
              {
                icon: Zap,
                label: "Magnet search",
                value: state.magnetApiEnabled ? `Enabled (${state.magnetApiBaseUrl})` : "Disabled",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm text-foreground truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {syncStarted && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Scanning your library… you&apos;ll be redirected when ready.
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? (
          <button
            onClick={goBack}
            disabled={saving || syncStarted}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 6 ? (
          <button
            onClick={goNext}
            disabled={!canAdvance[step]}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={completeSetup}
            disabled={saving || syncStarted}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving || syncStarted ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {syncStarted ? "Syncing…" : "Saving…"}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Finish &amp; Sync
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
