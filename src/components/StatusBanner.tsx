"use client";

import { CheckCircle, AlertTriangle, Info } from "lucide-react";

type StatusBannerProps = {
  tone?: "info" | "success" | "error";
  message: string;
};

const config = {
  success: {
    classes: "border-success/30 bg-success-muted text-success",
    Icon: CheckCircle,
  },
  error: {
    classes: "border-error/30 bg-error-muted text-error",
    Icon: AlertTriangle,
  },
  info: {
    classes: "border-info/30 bg-info-muted text-info",
    Icon: Info,
  },
} as const;

export function StatusBanner({ tone = "info", message }: StatusBannerProps) {
  const { classes, Icon } = config[tone];

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm 2xl:px-5 2xl:py-4 2xl:text-base ${classes}`}
      role="status"
    >
      <Icon className="h-4 w-4 shrink-0 2xl:h-5 2xl:w-5" />
      {message}
    </div>
  );
}
