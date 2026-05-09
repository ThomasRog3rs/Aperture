import type { SyncEmitter } from "./types";

const encoder = new TextEncoder();

export function sseChunk(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function createSseResponse(
  handler: (emit: SyncEmitter, signal: AbortSignal) => Promise<void>,
  aborter: AbortController
): Response {
  const { signal } = aborter;

  const stream = new ReadableStream({
    async start(controller) {
      const emit: SyncEmitter = (data) => controller.enqueue(sseChunk(data));
      try {
        await handler(emit, signal);
      } catch (err) {
        if (!signal.aborted) {
          emit({ type: "error", error: err instanceof Error ? err.message : "Sync failed." });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      aborter.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
