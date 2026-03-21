import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id?: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const body = (await request.json()) as { currentTime?: number; duration?: number };
  const { currentTime, duration } = body;

  if (typeof currentTime !== "number") {
    return NextResponse.json({ error: "currentTime is required." }, { status: 400 });
  }

  const db = getDb();

  // Update watch progress
  db.prepare(
    "UPDATE episodes SET watchProgressSeconds = ? WHERE id = ?"
  ).run(Math.round(currentTime), id);

  // Auto-mark as watched at 90% completion
  if (typeof duration === "number" && duration > 0 && currentTime / duration >= 0.9) {
    db.prepare("UPDATE episodes SET watched = 1 WHERE id = ? AND watched = 0").run(id);
  }

  return NextResponse.json({ ok: true });
}
