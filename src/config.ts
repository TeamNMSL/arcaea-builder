import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";

export interface ProjectConfig {
  tools: {
    apktool: string;
    jarsigner: string;
    "7z": string;
  };
  targets: {
    android?: string;
    ios?: string;
  };
  version: string;
  androidPackage: {
    versionCode: number;
    signing: {
      keystore: string;
      storepass: string;
      alias: string;
    }
  };
  name: string;
  packageId: string;
  server: string;
  icon: string;
  packs: {
    free?: string[];
    story?: string[];
    sidestory?: string[];
    collab?: string[];
  };
}

export interface BinaryPatchConfig {
  targets: {
    android: Record<string, string>;
    ios: Record<string, string>;
  }
}

export function loadConfig(projectDir: string) {
  logger.info(`Project directory: ${projectDir}`);

  global["projectDir"] = projectDir;
  global["projectDistDir"] = path.join(projectDir, "dist");
  global["projectPacksDir"] = path.join(projectDir, "packs");
  global["projectOriginalDir"] = path.join(projectDir, "original");
  global["projectConfig"] = yaml.load(fs.readFileSync(path.join(projectDir, "project.yaml"), "utf-8"));
  global["binaryPatchConfig"] = yaml.load(fs.readFileSync(path.join(projectDir, "binary.yaml"), "utf-8"));

  const projectDistDir = path.join(projectDir, "dist");
  fs.ensureDirSync(projectDistDir);
}
