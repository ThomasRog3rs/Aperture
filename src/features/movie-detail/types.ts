import type { Movie } from "@/lib/types";

export type Notice = {
  tone: "info" | "success" | "error";
  message: string;
};

export type FolderImage = {
  name: string;
  url: string;
};

export type MovieResponse = {
  movie?: Movie;
  error?: string;
};

export type FolderImagesResponse = {
  images?: FolderImage[];
  error?: string;
};

export type PlayResponse = {
  status?: string;
  error?: string;
};

export type UpdateMoviePayload = {
  titleClean?: string;
  posterPath?: string | null;
  userGenres?: string[];
  xxxRated?: boolean;
  watched?: boolean;
};

