import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import yaml from "js-yaml";

import { Action } from "@/action";
import { ArcPackMeta, ArcSongMeta, ArcSongMetaWithFrom, PackMeta, SongData } from "@/lib/interfaces";
import * as database from "@/lib/songDatabase";
import { getOriginalSong } from "@/lib/originalSong";
import { applyFilters } from "@/filter";
import { whenExist } from "@/lib/utils";
import { makePreview } from "@/lib/audioUtils";
import { getDirectoryLastModifiedTime, withCache } from "@/lib/cache";

function validateSongMeta(id: string, song: SongData) {
  if (typeof song.meta.title_localized !== "object") logger.fatal(`Song ${id}'s title_localized must be an object`);
  Object.keys(song.meta.title_localized).forEach(k => {
    if (!["en", "ja", "ko", "zh-Hans", "zh-Hant"].includes(k))
      logger.error(`Invalid language in song ${id}'s title: ${k}`);
  })
  if (typeof song.meta.artist !== "string") logger.fatal(`Song ${id}'s artist must be a string`);
  if (typeof song.meta.bpm !== "string") logger.fatal(`Song ${id}'s bpm must be a string (display BPM)`);
  if (!Number.isFinite(song.meta.bpm_base)) logger.fatal(`Song ${id}'s bpm_base must be a number (in-game BPM)`);
  if (!(song.preview && song.meta.remote_dl)) {
    if (!Number.isSafeInteger(song.meta.audioPreview)) logger.fatal(`Song ${id}'s audioPreview must be an integer`);
    if (!Number.isSafeInteger(song.meta.audioPreviewEnd)) logger.fatal(`Song ${id}'s audioPreviewEnd must be an integer`);
  }
  if (![0, 1].includes(song.meta.side)) logger.fatal(`Song ${id}'s side must be 0 or 1`);
  if (!Array.isArray(song.meta.difficulties)) logger.fatal(`Song ${id}'s difficulties must be an Array`);
  for (const d of song.meta.difficulties) {
    if (![0, 1, 2, 3].includes(d.ratingClass)) logger.fatal(`Song ${id}'s difficulty's ratingClass must be 0, 1, 2 or 3`);
    if (typeof d.chartDesigner !== "string") logger.fatal(`Song ${id}'s difficulty's chartDesigner must be a string`);
    if (typeof d.jacketDesigner !== "string") logger.fatal(`Song ${id}'s difficulty's jacketDesigner must be a string`);
  }
  if (song.meta.difficulties.length > new Set(song.meta.difficulties.map(d => d.ratingClass)).size)
    logger.fatal(`Song ${id}'s difficulty's ratingClass must be 0, 1, 2 or 3`);
}

async function getSong(directory: string): Promise<SongData> {
  const cacheKey = `song:${path.relative(projectPacksDir, directory)}`;
  return await withCache(cacheKey, await getDirectoryLastModifiedTime(directory), async () => {
    const songMetaFile = path.join(directory, "song.yaml");
    const songMetaOrFrom = yaml.load(await fs.readFile(songMetaFile, "utf-8")) as ArcSongMetaWithFrom;
    const originalMeta = JSON.parse(JSON.stringify(songMetaOrFrom)) as ArcSongMetaWithFrom;
    let song: SongData;
    if (songMetaOrFrom.from) {
      const { from, includeUnlock, filters, ...override } = songMetaOrFrom;
      const [id, bundle] = from.split('/').reverse();
      song = await getOriginalSong(bundle, id, includeUnlock, override);
      if (filters) await applyFilters(song, filters);
      song.originalMeta = originalMeta;
    } else {
      song = {
        originalMeta,
        meta: songMetaOrFrom as ArcSongMeta,
        music: await fs.readFile(path.join(directory, "base.ogg")),
        preview: await whenExist(path.join(directory, "preview.ogg")),
        baseCover: await fs.readFile(path.join(directory, "base.jpg")),
        baseCover256: await whenExist(path.join(directory, "base_256.jpg")),
        baseBackground: await whenExist(path.join(directory, "bg.jpg")),
        difficulties: Object.fromEntries(await Promise.all(songMetaOrFrom.difficulties.map(async ({ ratingClass: i }) => ([i, {
          chart: await fs.readFile(path.join(directory, `${i}.aff`), "utf-8"),
          cover: await whenExist(path.join(directory, `${i}.jpg`)),
          cover256: await whenExist(path.join(directory, `${i}_256.jpg`)),
          background: await whenExist(path.join(directory, `bg_${i}.jpg`)),
        }] as const))))
      };
    }
  
    // Make preview (if not exist) for download songs
    if (song.meta.remote_dl && !song.preview) {
      song.preview = await makePreview(song.music, song.meta.audioPreview, song.meta.audioPreviewEnd);
    }
    song.meta.audioPreview ||= 0;
    song.meta.audioPreviewEnd ||= 0;

    async function scale([cover, cover256]: [Buffer, Buffer]): Promise<[cover: Buffer, cover256: Buffer]> {
      const sharpCover = sharp(cover);
      if (!cover256 || (await sharp(cover256).metadata()).width !== 256)
        cover256 = await sharpCover.resize(256, 256).jpeg({ quality: 100 }).toBuffer();
      if ((await sharpCover.metadata()).width !== 512)
        cover = await sharpCover.resize(512, 512).jpeg({ quality: 100 }).toBuffer();
      return [cover, cover256];
    }

    // Scale song covers
    await Promise.all([-1, ...Object.keys(song.difficulties)].map(async (i: number) => {
      let covers: [cover: Buffer, cover256: Buffer] = i === -1 ? [song.baseCover, song.baseCover256] : [song.difficulties[i].cover, song.difficulties[i].cover256];
      if (!covers[0]) return;
      covers = await scale(covers);
      if (i === -1) [song.baseCover, song.baseCover256] = covers;
      else [song.difficulties[i].cover, song.difficulties[i].cover256] = covers;
    }));
  
    return song;
  });
}

export const action: Action = {
  dependencies: [],
  action: async () => {
    const outputSongsDir = path.join(projectDistDir, "assets", "songs");
    const outputDownloadsDir = path.join(projectDistDir, "download");
    const outputBgDir = path.join(projectDistDir, "assets", "img", "bg");
    const outputDatabase = path.join(projectDistDir, "arcsong.db");

    function fillEmptyDifficulties(song: ArcSongMeta) {
      const exists = (ratingClass: number) => song.difficulties.some(d => d.ratingClass === ratingClass);
      const nonExist: number[] = [];
      for (let i = 0 as const; i <= 2; i++)
        if (!exists(i)) {
          song.difficulties.push({
            ratingClass: i,
            chartDesigner: "",
            rating: 0
          });
          nonExist.push(i);
        }
      song.difficulties.sort((a, b) => a.ratingClass - b.ratingClass);
      return nonExist;
    }

    const copyFiles: Record<string, string | Buffer> = {};

    function addBg(data: Buffer): string {
      const md5 = crypto.createHash("md5").update(data).digest("hex");
      const bg = `bg_${md5}`;
      const targetBgFile = path.join(outputBgDir, `${bg}.jpg`);
      copyFiles[targetBgFile] = data;
      return bg;
    }

    async function processSongs() {
      const packs = Object.values(projectConfig.packs).filter(a => a).flat();
      const packId: Record<string, string> = {};
      const outPacks: ArcPackMeta[] = [];
      const outSongs: SongData[] = [];
      const unlocks: [string, number, object][] = [];

      if (await fs.pathExists(path.join(projectPacksDir, "single")))
        packs.push("single");

      for (const pack of packs) {
        const packDir = path.join(projectPacksDir, pack);
        const packInfo = yaml.load(fs.readFileSync(path.join(packDir, "pack.yaml"), "utf-8")) as PackMeta;
        const { packNoPrefix, songNoPrefix } = packInfo;
        const id = packNoPrefix ? pack : `pack_${pack}`;
        packId[pack] = id;

        if (packInfo.name) {
          outPacks.push(<ArcPackMeta>{
            id,
            plus_character: -1,
            name_localized: {
              en: packInfo.name
            },
            description_localized: {
              en: "",
              ja: ""
            }
          });
        }

        const packCover = path.join(packDir, "pack.png");
        if (fs.pathExistsSync(packCover)) {
          const targetPackCover = path.join(outputSongsDir, "pack", `select_${id}.png`);
          copyFiles[targetPackCover] = packCover;
        }

        logger.info(`Pack: ${id}`);

        const songs = fs.readdirSync(packDir).filter(s => fs.lstatSync(path.join(packDir, s)).isDirectory());
        for (const song of songs) {
          const songId = songNoPrefix ? song : `${pack}_${song}`;
          const songData = await getSong(path.join(packDir, song));

          songData.meta.id = songId;
          songData.meta.set = id;
          songData.meta.date = 0;
          songData.meta.purchase = "";
          if (typeof songData.meta.bpm === "number") songData.meta.bpm = String(songData.meta.bpm);
          
          validateSongMeta(songId, songData);

          const nonExistDifficulies = fillEmptyDifficulties(songData.meta);

          for (let i = -1; i <= 3; i++) {
            const bg = i === -1 ? songData.baseBackground : songData.difficulties[i]?.background;
            if (bg) {
              if (i === -1)
                songData.meta.bg = addBg(bg);
              else {
                const dif = songData.meta.difficulties.find(d => d.ratingClass === i);
                if (dif) dif.bg = addBg(bg);
                else logger.error(`No difficuly ${i} but custom background file for it exists.`);
              }
            }
          }

          outSongs.push(songData);

          logger.info(`Song: ${songId}`);

          // Constant and unlock
          const ratings = [-1, -1, -1, -1];

          for (const [i, difficulty] of songData.meta.difficulties.entries()) {
            if (typeof difficulty.rating === "string") {
              if (difficulty.rating.endsWith("+")) {
                difficulty.ratingPlus = true;
                difficulty.rating = difficulty.rating.slice(0, -1);
              }

              if (difficulty.rating === "?") difficulty.rating = "0";

              const x = Number(difficulty.rating);
              if (!Number.isSafeInteger(x) || String(x) !== difficulty.rating)
                logger.fatal(`Invalid rating ${difficulty.rating} for difficulty ${difficulty.ratingClass}`);
              difficulty.rating = x;
            }

            if (difficulty.jacketDesigner == null) difficulty.jacketDesigner = "";
            
            if (songData.difficulties[i]?.cover)
              difficulty.jacketOverride = true;
            else
              delete difficulty.jacketOverride;

            if (difficulty.rating !== 0) {
              const { constant } = difficulty;
              const constantInteger = constant * 10;
              if (constantInteger < 0 || !Number.isSafeInteger(constantInteger)) {
                logger.error(`Invalid constant ${constant} for song ${songId}'s diffuculty ${difficulty.ratingClass}`);
              } else {
                ratings[difficulty.ratingClass] = constantInteger;
              }
            }
      
            if (nonExistDifficulies.includes(difficulty.ratingClass)) {
              unlocks.push([songId, difficulty.ratingClass, [{ type: 5, rating: 114514 }]]);
            } else {
              if (difficulty.unlock)
                unlocks.push([songId, difficulty.ratingClass, difficulty.unlock]);
              if (!songData.difficulties[i]?.chart)
                logger.error(`Difficulty ${difficulty.ratingClass} defined in metadata but the chart file doesn't exist.`);
            }
          }
      
          await database.insert("songs", {
            sid: songId,
            name_en: songData.meta.title_localized.en,
            rating_pst: ratings[0],
            rating_prs: ratings[1],
            rating_ftr: ratings[2],
            rating_byn: ratings[3]
          });
      
        }
      }

      const outUnlocks = unlocks.map(([id, d, c]) => ({
        songId: id,
        ratingClass: d,
        conditions: c
      }));

      return [outSongs, outPacks, outUnlocks] as const;
    }

    async function writeSong(songData: SongData) {
      const remoteDownload = songData.meta.remote_dl;
      const outputSongDir = path.join(outputSongsDir, (remoteDownload ? "dl_" : "") + songData.meta.id);
      const outputDownloadDir = path.join(outputDownloadsDir, songData.meta.id);
      await fs.ensureDir(outputSongDir);
      if (remoteDownload) await fs.ensureDir(outputDownloadDir);

      async function write(filename: string, data: string | Buffer, isDownloaded = false) {
        if (data == null) return;
        await fs.writeFile(path.join((remoteDownload && isDownloaded) ? outputDownloadDir : outputSongDir, filename), data);
      }

      await Promise.all([
        write("song.yaml", yaml.dump(songData.originalMeta)),
        write("base.ogg", songData.music, true),
        remoteDownload && write("preview.ogg", songData.preview),
        write("base.jpg", songData.baseCover),
        write("base_256.jpg", songData.baseCover256),
        ...Object.entries(songData.difficulties).flatMap(([i, difficulty]) => [
          write(`${i}.aff`, difficulty.chart, true),
          write(`${i}.jpg`, difficulty.cover),
          write(`${i}_256.jpg`, difficulty.cover256)
        ]),
        // Write non-existing charts
        ...[0, 1, 2].filter(i => !(i in songData.difficulties)).map(i => write(`${i}.aff`, "", true))
      ]);
    }

    const bundledDatabase = path.resolve(__dirname, "../../assets/arcsong.db");
    fs.copyFileSync(bundledDatabase, outputDatabase);
    database.connect(outputDatabase);
    
    // Empty output directories
    fs.ensureDirSync(outputSongsDir);
    fs.emptyDirSync(outputSongsDir);
    fs.ensureDirSync(outputDownloadsDir);
    fs.emptyDirSync(outputDownloadsDir);
    fs.ensureDirSync(outputBgDir);
    fs.emptyDirSync(outputBgDir);
    fs.ensureDirSync(path.join(outputSongsDir, "pack"));

    // Clear database
    await database.runQuery("delete from charts");
    await database.runQuery("delete from alias");
    await database.runQuery("delete from songs");

    const [outSongs, outPacks, outUnlocks] = await processSongs();

    // Apply file changes
    fs.writeFileSync(path.join(outputSongsDir, "songlist"), JSON.stringify({ songs: outSongs.map(songData => songData.meta) }, null, 2));
    fs.writeFileSync(path.join(outputSongsDir, "packlist"), JSON.stringify({ packs: outPacks }, null, 2));
    fs.writeFileSync(path.join(outputSongsDir, "unlocks"), JSON.stringify({ unlocks: outUnlocks }, null, 2));

    await Promise.all(Object.entries(copyFiles).map(([dst, src]) => Buffer.isBuffer(src) ? fs.writeFile(dst, src) : fs.copy(src, dst)));

    // Write songs
    await Promise.all(outSongs.map(async songData => await writeSong(songData)));

    logger.info(`Written database to ${outputDatabase}`);

    return true;
  }
};
