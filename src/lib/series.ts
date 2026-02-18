import crypto from "node:crypto";
import path from "node:path";
import { cleanTitle } from "@/lib/cleanTitle";

export function getSeriesId(seriesFolderPath: string): string {
  return crypto.createHash("sha1").update(seriesFolderPath).digest("hex");
}

export function getSeriesTitle(seriesFolderPath: string): {
  titleClean: string;
  year: number | null;
} {
  return cleanTitle(path.basename(seriesFolderPath));
}
