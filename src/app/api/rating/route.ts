import { NextResponse } from "next/server";
import { updatePersonalRating } from "@/lib/storage";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { id?: string; personalRating?: number | null }
    | null;

  const id = body?.id;
  const personalRating = body?.personalRating ?? null;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  if (
    personalRating !== null &&
    (typeof personalRating !== "number" ||
      Number.isNaN(personalRating) ||
      personalRating < 0 ||
      personalRating > 10)
  ) {
    return NextResponse.json(
      { error: "personalRating must be between 0 and 10." },
      { status: 400 }
    );
  }

  updatePersonalRating(id, personalRating);

  return NextResponse.json({ id, personalRating });
}

