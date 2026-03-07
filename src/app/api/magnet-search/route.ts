import { NextResponse } from "next/server";
import {
  buildPirateBayVideoSearchUrl,
  normalizeMagnetResult,
} from "@/lib/magnetApi";
import type { MagnetApiRawResult, MagnetSearchResult } from "@/lib/types";

export const runtime = "nodejs";

type MagnetApiErrorResponse = {
  Message?: string;
};

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as MagnetApiErrorResponse).Message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function isNoDataMessage(message: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("no data found");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Query is required.", results: [] satisfies MagnetSearchResult[] },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(buildPirateBayVideoSearchUrl(query), {
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    const message = extractErrorMessage(payload);

    if (!response.ok) {
      if (isNoDataMessage(message)) {
        return NextResponse.json({ results: [] satisfies MagnetSearchResult[] });
      }

      return NextResponse.json(
        {
          error: message || "MagnetAPI request failed.",
          results: [] satisfies MagnetSearchResult[],
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(payload)) {
      console.error("MagnetAPI returned an unexpected response.", payload);
      if (isNoDataMessage(message)) {
        return NextResponse.json({ results: [] satisfies MagnetSearchResult[] });
      }

      return NextResponse.json(
        {
          error: "MagnetAPI returned an unexpected response.",
          results: [] satisfies MagnetSearchResult[],
        },
        { status: 502 }
      );
    }

    const results = payload
      .map((entry) => normalizeMagnetResult(entry as MagnetApiRawResult))
      .filter((entry): entry is MagnetSearchResult => entry !== null);

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "MagnetAPI timed out."
        : error instanceof Error
          ? error.message
          : "Failed to reach MagnetAPI.";

    return NextResponse.json(
      { error: message, results: [] satisfies MagnetSearchResult[] },
      { status: 502 }
    );
  }
}
