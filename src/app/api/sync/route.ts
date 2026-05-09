import { abortActiveSync, startSync } from "@/lib/sync/syncController";
import { createSseResponse } from "@/lib/sync/sseTransport";
import { runSync } from "@/lib/sync/syncOrchestrator";

export const runtime = "nodejs";

export async function DELETE() {
  const cancelled = abortActiveSync();
  return Response.json({ cancelled });
}

export async function POST() {
  const aborter = startSync();
  return createSseResponse(
    (emit, signal) => runSync(signal, emit, aborter),
    aborter
  );
}
