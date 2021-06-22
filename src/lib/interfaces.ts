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

export interface ArcSongList {
  songs: ArcSongMeta[];
}
