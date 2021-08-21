import type { FilterOptions } from "@/filter";

export interface PackMeta {
  name: string;
  packNoPrefix: boolean; // For Single
  songNoPrefix: boolean;
}

export interface ArcPackMeta {
  id: string;
  plus_character: -1;
  name_localized: {
    en: string
  };
  description_localized: {
    en: ""
  };
}

export interface ArcPackList {
  packs: ArcPackMeta[];
}

export interface ArcSongDifficultyMeta {
  ratingClass: 0 | 1 | 2 | 3;
  chartDesigner: string;
  jacketDesigner?: string;
  jacketOverride?: boolean;
  rating: number | string;
  constant?: number;
  ratingPlus?: boolean;
  bg?: string;
  unlock?: object;
}

export interface ArcSongMeta {
  id?: string;
  set?: string;
  date?: number;
  remote_dl?: boolean;
  title_localized: {
    en: string;
    ja?: string;
    "zh-Hans"?: string;
    "zh-Hant"?: string;
  };
  artist: string;
  bpm: string;
  bpm_base: number;
  purchase?: "";
  audioPreview: number,
  audioPreviewEnd: number,
  side: 0 | 1,
  bg: string,
  version: string;
  difficulties: ArcSongDifficultyMeta[];
}

export interface ArcSongMetaWithFrom extends ArcSongMeta {
  from: string;
  includeUnlock: boolean | number[];
  filters: FilterOptions[];
}

export interface ArcSongList {
  songs: ArcSongMeta[];
}

export interface ArcUnlockInfo {
  songId: string;
  ratingClass: number;
  conditions: unknown[];
}

export interface ArcUnlockList {
  unlocks: ArcUnlockInfo[];
}

export interface SongData {
  originalMeta?: ArcSongMetaWithFrom;
  meta: ArcSongMeta;
  music: Buffer;
  baseCover: Buffer;
  baseCover256?: Buffer;
  preview?: Buffer;
  baseBackground?: Buffer;
  difficulties: Record<number, {
    chart: string;
    background?: Buffer;
    cover?: Buffer;
    cover256?: Buffer;
  }>;
}
