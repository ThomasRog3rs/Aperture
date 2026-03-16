import { NextResponse } from "next/server";
import { purgeDeletedItems } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST() {
  const purged = purgeDeletedItems();
  return NextResponse.json({ purged });
}
