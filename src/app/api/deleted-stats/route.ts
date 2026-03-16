import { NextResponse } from "next/server";
import { countDeletedItems } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const stats = countDeletedItems();
  return NextResponse.json(stats);
}
