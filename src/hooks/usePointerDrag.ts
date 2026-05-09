"use client";

import { useCallback } from "react";

type UsePointerDragOptions = {
  onStart?: (clientX: number) => void;
  onMove: (clientX: number) => void;
  onEnd?: (clientX: number | null) => void;
};

export function usePointerDrag({
  onStart,
  onMove,
  onEnd,
}: UsePointerDragOptions) {
  return useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();

      onStart?.(event.clientX);
      onMove(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        onMove(moveEvent.clientX);
      };
      const stopDragging = (clientX: number | null) => {
        onEnd?.(clientX);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
      };
      const handlePointerUp = (upEvent: PointerEvent) => stopDragging(upEvent.clientX);
      const handlePointerCancel = () => stopDragging(null);

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [onEnd, onMove, onStart]
  );
}
