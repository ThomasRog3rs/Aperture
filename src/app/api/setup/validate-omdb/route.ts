import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { apiKey?: string } | null;
  const apiKey = body?.apiKey?.trim();

  if (!apiKey) {
    return NextResponse.json({ valid: false, error: "API key is required." }, { status: 400 });
  }

  try {
    const url = `http://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&t=test&type=movie`;
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ valid: false, error: "Could not reach OMDb." });
    }
    const data = (await response.json()) as { Response: string; Error?: string };
    // OMDb returns Response:"False" with Error:"Invalid API key!" for bad keys.
    // Any other response (including "Movie not found!") means the key is valid.
    if (data.Error === "Invalid API key!") {
      return NextResponse.json({ valid: false, error: "Invalid API key." });
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false, error: "Could not reach OMDb. Check your internet connection." });
  }
}
