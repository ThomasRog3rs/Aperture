import { NextResponse } from "next/server";
import { getSetting } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const libraryRootPath = getSetting("libraryRootPath");
  const omdbApiKey = getSetting("omdbApiKey") ?? process.env.OMDB_API_KEY?.trim();
  const completed = Boolean(libraryRootPath && omdbApiKey);
  return NextResponse.json({ completed });
}
