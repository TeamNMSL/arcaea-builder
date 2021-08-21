import fs from "fs";
import path from "path";
import readline from "readline";
import yaml from "js-yaml";

import { ArcSongList } from "@/lib/interfaces";
import { processOriginalSongMeta } from "@/lib/originalSong";

const rl = readline.createInterface(process.stdin, process.stdout);
async function prompt(message: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    rl.question(message, resolve);
  });
}

export default async (args: string[]) => {
  const songsDir = args[0];

  const songlistFile = path.join(songsDir, "songlist");
  const songlist = JSON.parse(fs.readFileSync(songlistFile, "utf-8")) as ArcSongList;

  const songs = args.length > 1
              ? args.slice(1)
              : fs.readdirSync(songsDir).filter(id => fs.lstatSync(path.join(songsDir, id)).isDirectory());

  for (const song of songs) {
    const originalSongInfo = songlist.songs.find(s => s.id === song);
    if (!originalSongInfo) {
      logger.error("No such song in songlist: " + song);
      continue;
    }
  
    const constants = (await prompt(`Constants for ${song} (e.g. 1.5 7.5 9.9): `)).split(" ").filter(s => s).map(Number);

    const songMeta = processOriginalSongMeta(originalSongInfo, constants);
    const outFile = path.join(songsDir, song, "song.yaml");
    fs.writeFileSync(outFile, yaml.dump(songMeta));
    logger.info(`Written ${outFile}`);
  }

  rl.close();
};
