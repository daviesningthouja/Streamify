export interface TorrentInfo {
  name: string;
  magnetURI: string;
  size: number;
}

export type TorrentStatus =
  | "idle"
  | "seeding"
  | "downloading"
  | "ready"
  | "error";