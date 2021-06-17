import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import { ArcSongMeta } from "@/lib/interfaces";

export default async (args: string[]) => {
  const write = args[0] === "-w";
  const chartFiles = write ? args.slice(1) : args;

  for (const filename of chartFiles) {
    const songInfoFile = path.join(path.dirname(filename), "song.yaml")
    const songInfo = yaml.load(fs.readFileSync(songInfoFile, "utf-8")) as ArcSongMeta;
    const bpm = songInfo.bpm_base.toFixed(2);

    const chart = fs.readFileSync(filename, "utf-8");
    const fixed = chart.replace(/timing\(([\S\s]+?)\)/g, (_, s) => {
      const a = s.split(",");
      a[1] = bpm;
      return `timing(${a.join(",")})`;
    });

    if (chart.trim() !== fixed.trim()) {
      logger.info(`Modified ${filename}`);
      if (write) fs.writeFileSync(filename, fixed);
    }
  }

  if (!write) {
    logger.warn("Changes NOT written to disk");
    logger.warn("Append -w argument before ALL chart files to write fixed chart files back");
  }
};
