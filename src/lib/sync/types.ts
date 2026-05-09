export type SyncEmitter = (data: object) => void;

export type MovieSyncStats = {
  updated: number;
  notFound: number;
  errors: number;
  deleted: number;
};

export type SeasonSyncStats = {
  updated: number;
  notFound: number;
  errors: number;
  deleted: number;
};

export type SyncSummary = {
  mode: string;
  folders: {
    checked: number;
    rootChecked: number;
    seasonChecked: number;
    changed: number;
    rescanned: number;
  };
  movies: MovieSyncStats & { scanned: number };
  seasons: SeasonSyncStats & { scanned: number };
};
