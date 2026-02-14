"use client";

type StatusBannerProps = {
  tone?: "info" | "success" | "error";
  message: string;
};

export function StatusBanner({ tone = "info", message }: StatusBannerProps) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : "border-blue-500/40 bg-blue-500/10 text-blue-100";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${toneClasses}`}
      role="status"
    >
      {message}
    </div>
  );
}

