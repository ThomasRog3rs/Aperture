import { NextResponse } from "next/server";
import { listGenres } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const genres = listGenres();
  return NextResponse.json({ genres });
}
