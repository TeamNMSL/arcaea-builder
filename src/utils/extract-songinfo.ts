import fs from "fs";
import path from "path";
import readline from "readline";
import yaml from "js-yaml";

import { ArcSongList } from "@/lib/interfaces";

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
    const songInfo = songlist.songs.find(s => s.id === song);
    if (!songInfo) {
      logger.error("No such song in songlist: " + song);
      continue;
    }
  
    const constants = (await prompt(`Constants for ${song} (e.g. 1.5 7.5 9.9): `)).split(" ").filter(s => s).map(Number);
  
    delete songInfo.id;
    delete songInfo.set;
    delete songInfo.purchase;
    delete songInfo["world_unlock"];
    delete songInfo["remote_dl"];
    delete songInfo["songlist_hidden"];
    for (const d of songInfo.difficulties) {
      delete d["hidden_until_unlocke"];
      d.constant = constants[d.ratingClass];
    }

    const outFile = path.join(songsDir, song, "song.yaml");
    fs.writeFileSync(outFile, yaml.dump(songInfo));
    logger.info(`Written ${outFile}`);
  }

  rl.close();
};
