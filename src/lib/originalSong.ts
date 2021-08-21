import path from "path";
import fs from "fs-extra";
import { merge } from "lodash";
import { ArcSongList, ArcSongMeta, ArcUnlockInfo, ArcUnlockList, SongData } from "./interfaces"
import { whenExist } from "./utils";

async function firstExisting(...filePaths: string[]) {
  for (const filePath of filePaths)
    if (await fs.pathExists(filePath))
      return filePath;
  throw new Error(`None of the following paths exist: ${JSON.stringify(filePaths, null, 2)}`);
}

export function processOriginalSongMeta(originalSongMeta: ArcSongMeta, constants: number[], includeUnlock: boolean | number[], unlocks?: ArcUnlockInfo[]) {
  const songMeta = JSON.parse(JSON.stringify(originalSongMeta)) as ArcSongMeta;
  delete songMeta.id;
  delete songMeta.set;
  delete songMeta.purchase;
  delete songMeta["world_unlock"];
  delete songMeta["remote_dl"];
  delete songMeta["songlist_hidden"];
  delete songMeta["date"];
  delete songMeta["version"];
  for (const d of songMeta.difficulties) {
    delete d["hidden_until_unlocked"];
    delete d["jacketOverride"];
    d.constant = constants[d.ratingClass] || 0;

    if (d.rating === 0) d.rating = "?";
    if (d.ratingPlus) {
      delete d.ratingPlus;
      d.rating = String(d.rating) + "+";
    }

    if (unlocks && (Array.isArray(includeUnlock) ? includeUnlock.includes(d.ratingClass) : includeUnlock)) {
      const conditions = unlocks.find(item => item.songId === originalSongMeta.id && item.ratingClass === d.ratingClass)?.conditions;
      if (conditions) d.unlock = conditions;
    }
  }

  return songMeta;
}

export async function getOriginalSong(bundle: string, id: string, includeUnlock: boolean | number[], override: Partial<ArcSongMeta>): Promise<SongData> {
  const bundleDir = bundle ? path.join(projectOriginalDir, bundle) : path.join(projectDistDir, "originalSongs");
  const downloadDir = path.join(projectOriginalDir, "dl");

  const songListFile = path.join(bundleDir, "songlist");
  const songList = await fs.readJSON(songListFile) as ArcSongList;

  const unlocksFile = path.join(bundleDir, "unlocks");
  const unlocks = await fs.readJSON(unlocksFile) as ArcUnlockList;

  const originalSongMeta = songList.songs.find(song => song.id === id);
  if (!originalSongMeta) {
    throw new Error(`Original song not found in bundle ${bundle}: ${id}`);
  }

  const songMeta = processOriginalSongMeta(originalSongMeta, [], includeUnlock, unlocks.unlocks);
  const mergedSongMeta = merge(songMeta, override);

  const songBundleDirWithoutPrefix = path.join(bundleDir, id);
  const songBundleDirWithPrefix = path.join(bundleDir, `dl_${id}`);
  const songBundleDir = await fs.pathExists(songBundleDirWithoutPrefix) ? songBundleDirWithoutPrefix : songBundleDirWithPrefix;

  return <SongData>{
    meta: mergedSongMeta,
    baseCover: await fs.readFile(path.join(songBundleDir, "base.jpg")),
    baseCover256: await fs.readFile(path.join(songBundleDir, "base_256.jpg")),
    music: await fs.readFile(await firstExisting(path.join(songBundleDir, "base.ogg"), path.join(downloadDir, id))),
    preview: await whenExist(path.join(songBundleDir, "preview.ogg")),
    difficulties: Object.fromEntries(await Promise.all(songMeta.difficulties.map(async ({ ratingClass: i }) => ([i, {
      chart: await fs.readFile(await firstExisting(path.join(songBundleDir, `${i}.aff`), path.join(downloadDir, `${id}_${i}`)), "utf-8"),
      cover: await whenExist(path.join(songBundleDir, `${i}.jpg`)),
      cover256: await whenExist(path.join(songBundleDir, `${i}_256.jpg`))
    }] as const))))
  };
}
