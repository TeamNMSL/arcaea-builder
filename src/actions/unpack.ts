import path from "path";
import fs from "fs-extra";

import { Action } from "@/action";
import { exec } from "@/lib/exec";

async function deleteExtraSongs(assetsDir: string) {
  const songsDir = path.join(assetsDir, "songs");
  const files = await fs.readdir(songsDir);
  await Promise.all(files.filter(s => s !== "tutorial").map(s => fs.remove(path.join(songsDir, s))));
}

export const action: Action = {
  dependencies: [],
  action: async () => {
    if (projectConfig.targets.android) {
      const androidOriginalPackage = path.join(projectOriginalDir, projectConfig.targets.android);
      const androidOriginalPackageDir = path.join(projectOriginalDir, "package");

      logger.info("Removing old Android unpacked files");
      await fs.remove(androidOriginalPackageDir);

      logger.info("Unpacking Android original package");
      exec("apktool", [
        "d",
        androidOriginalPackage,
        "-o",
        androidOriginalPackageDir
      ]);
  
      const extra64BitBinaryDir = path.join(androidOriginalPackageDir, "lib", "arm64-v8a");
      logger.info("Removing extra 64 bit binaries from Android unpacked files");
      await fs.remove(extra64BitBinaryDir);
  
      logger.info("Removing ALL songs (except for tutorial) from Android unpack files")
      await deleteExtraSongs(path.join(androidOriginalPackageDir, "assets"));  
    }

    if (projectConfig.targets.ios) {
      const iOSOriginalPackage = path.join(projectOriginalDir, projectConfig.targets.ios);
      const iOSOriginalPackageDir = path.join(projectOriginalDir, "Payload");

      logger.info("Removing old iOS unpacked files");
      await fs.remove(iOSOriginalPackageDir);
  
      logger.info("Unpacking iOS original package");
      exec("7z", [
        "x",
        iOSOriginalPackage,
        "-o" + projectOriginalDir
      ]);
  
      const unpackediOSAppDir = path.join(iOSOriginalPackageDir, "Arc-mobile.app");
      const extraFiles = ["Assets.car", "CrackerXI", "PlugIns"];
      logger.info("Removing extra files from iOS unpacked files");
      await Promise.all(extraFiles.map(file => fs.remove(path.join(unpackediOSAppDir, file))));
  
      logger.info("Removing ALL songs (except for tutorial) from iOS unpack files")
      await deleteExtraSongs(unpackediOSAppDir);
    }

    return true;
  }
};
