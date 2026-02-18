import { NextResponse } from "next/server";
import { listGenres, listPeople } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const genres = listGenres();
  const people = listPeople();
  const unique = new Map<string, string>();
  const addToUnique = (names: string[]) => {
    names.forEach((name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (unique.has(key)) return;
      unique.set(key, trimmed);
    });
  };
  addToUnique(people.directors);
  addToUnique(people.writers);
  addToUnique(people.actors);
  const combined = Array.from(unique.values()).sort((a, b) =>
    a.localeCompare(b)
  );
  return NextResponse.json({ genres, people: combined });
}
