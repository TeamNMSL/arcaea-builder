import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import yaml from "js-yaml";

import { Action } from "@/action";
import { ArcPackMeta, ArcSongMeta, PackMeta } from "@/lib/interfaces";
import * as database from "@/lib/songDatabase";

export const action: Action = {
  dependencies: [],
  action: async () => {
    const outputSongsDir = path.join(projectDistDir, "assets", "songs");
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

    const copyFiles: Record<string, string> = {};

    function addBg(filename: string): string {
      const md5 = crypto.createHash("md5").update(fs.readFileSync(filename)).digest("hex");
      const bg = `bg_${md5}`;
      const targetBgFile = path.join(outputBgDir, `${bg}.jpg`);
      copyFiles[targetBgFile] = filename;
      return bg;
    }

    async function processSongs() {
      const packs = Object.values(projectConfig.packs).filter(a => a).flat();
      const packId: Record<string, string> = {};
      const outPacks: ArcPackMeta[] = [];
      const outSongs: ArcSongMeta[] = [];
      const locked: [string, number][] = [];

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
          const songDir = path.join(packDir, song);
          const songInfo = yaml.load(fs.readFileSync(path.join(songDir, "song.yaml"), "utf-8")) as ArcSongMeta;
          const songId = songNoPrefix ? song : `${pack}_${song}`;

          songInfo.id = songId;
          songInfo.set = id;
          songInfo.date = 0;
          songInfo.purchase = "";
          if (typeof songInfo.bpm === "number") songInfo.bpm = String(songInfo.bpm);

          const nonExistDifficulies = fillEmptyDifficulties(songInfo);

          for (let i = -1; i <= 3; i++) {
            const bgFile = i === -1 ? "bg.jpg" : `bg_${i}.jpg`;
            const bgPath = path.join(songDir, bgFile);
            if (fs.pathExistsSync(bgPath)) {
              if (i === -1)
                songInfo.bg = addBg(bgPath);
              else {
                const dif = songInfo.difficulties.find(d => d.ratingClass === i);
                if (dif) dif.bg = addBg(bgPath);
                else logger.error(`No difficuly ${i} but background file ${bgFile} exists.`);
              }
            }
          }

          outSongs.push(songInfo);

          const targetSongDir = path.join(outputSongsDir, songId);
          copyFiles[targetSongDir] = songDir;

          logger.info(`Song: ${songId}`);

          // Constant and unlock
          const ratings = [-1, -1, -1, -1];

          for (const difficulty of songInfo.difficulties) {
            if (typeof difficulty.rating === "string") {
              if (difficulty.rating.endsWith("+")) {
                difficulty.ratingPlus = true;
                difficulty.rating = difficulty.rating.slice(0, -1);
              }

              const x = Number(difficulty.rating);
              if (!Number.isSafeInteger(x) || String(x) !== difficulty.rating)
                logger.fatal(`Invalid rating ${difficulty.rating} for difficulty ${difficulty.ratingClass}`);
              difficulty.rating = x;
            }

            if (difficulty.jacketDesigner == null) difficulty.jacketDesigner = "";
            if (await fs.pathExists(path.join(songDir, `${difficulty.ratingClass}.jpg`))) difficulty.jacketOverride = true;

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
              locked.push([songId, difficulty.ratingClass]);
            } else {
              if (!await fs.pathExists(path.join(songDir, `${difficulty.ratingClass}.aff`)))
                logger.error(`Difficulty ${difficulty.ratingClass} defined in metadata but the chart file doesn't exist.`);
            }
          }
      
          await database.insert("songs", {
            sid: songId,
            name_en: songInfo.title_localized.en,
            rating_pst: ratings[0],
            rating_prs: ratings[1],
            rating_ftr: ratings[2],
            rating_byn: ratings[3]
          });
      
        }
      }

      const outUnlocks = locked.map(([id, d]) => ({
        songId: id,
        ratingClass: d,
        conditions: [
          {

            type: 5,
            rating: 114514
          }
        ]
      }));

      return [outSongs, outPacks, outUnlocks] as const;
    }

    async function postProcessSong(songDir: string) {
      // Delete unused files
      const unused = ["bg.jpg", "bg_0.jpg", "bg_1.jpg", "bg_2.jpg", "bg_3.jpg"];
      await Promise.all(unused.map(file => fs.rm(path.join(songDir, file), { force: true })));

      // Scale song cover pictures
      const covers = ["base", "0", "1", "2", "3"];
      await Promise.all(covers.map(async cover => {
        const originalSize = path.join(songDir, `${cover}.jpg`);
        const smallSize = path.join(songDir, `${cover}_256.jpg`);
        if (!await fs.pathExists(originalSize)) return;

        const originalImage = sharp(await fs.readFile(originalSize));
        const meta = await originalImage.metadata();
        
        if (meta.width !== 512) {
          await originalImage.resize(512, 512).jpeg({ quality: 100 }).toFile(originalSize);
          logger.info(`Resizing ${originalSize} image for song "${path.basename(songDir)}"`);
        }
        if (!await fs.pathExists(smallSize)) {
          await originalImage.resize(256, 256).jpeg({ quality: 100 }).toFile(smallSize);
          logger.info(`Resizing ${smallSize} image for song "${path.basename(songDir)}"`);
        }
      }));
    }

    const bundledDatabase = path.resolve(__dirname, "../../assets/arcsong.db");
    fs.copyFileSync(bundledDatabase, outputDatabase);
    database.connect(outputDatabase);
    
    // Empty output directories
    fs.ensureDirSync(outputSongsDir);
    fs.emptyDirSync(outputSongsDir);
    fs.ensureDirSync(outputBgDir);
    fs.emptyDirSync(outputBgDir);
    fs.ensureDirSync(path.join(outputSongsDir, "pack"));

    // Clear database
    await database.runQuery("delete from charts");
    await database.runQuery("delete from alias");
    await database.runQuery("delete from songs");

    const [outSongs, outPacks, outUnlocks] = await processSongs();

    // Apply file changes
    fs.writeFileSync(path.join(outputSongsDir, "songlist"), JSON.stringify({ songs: outSongs }, null, 2));
    fs.writeFileSync(path.join(outputSongsDir, "packlist"), JSON.stringify({ packs: outPacks }, null, 2));
    fs.writeFileSync(path.join(outputSongsDir, "unlocks"), JSON.stringify({ unlocks: outUnlocks }, null, 2));

    await Promise.all(Object.entries(copyFiles).map(([dst, src]) => fs.copy(src, dst)));

    // Postprocess
    await Promise.all(fs.readdirSync(outputSongsDir).map(async song => {
      const songDir = path.join(outputSongsDir, song);
      if (!(await fs.lstat(songDir)).isDirectory()) return;
      await postProcessSong(songDir);
    }));

    logger.info(`Written database to ${outputDatabase}`);

    return true;
  }
};
