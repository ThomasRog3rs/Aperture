"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useOutsideClick(
  refs: Array<RefObject<HTMLElement | null>>,
  enabled: boolean,
  onOutsideClick: () => void
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onOutsideClick();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, onOutsideClick, refs]);
}
