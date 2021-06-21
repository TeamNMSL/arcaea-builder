import puppeteer from "puppeteer";
import fs from "fs-extra";
import path from "path";
import sharp from "sharp";

import type { Action } from "@/action";

export const action: Action = {
  dependencies: [],
  action: async () => {
    if (!projectConfig.icon) {
      logger.warn("No icon specfied in project config, skipping");
      return true;
    }

    const sourceFile = path.join(projectDir, projectConfig.icon);
    logger.info(`Loading image file: ${sourceFile}`);

    const sourceFileBuffer = fs.readFileSync(sourceFile);
    const sourceImage = sharp(sourceFileBuffer);
    const sourceImageURL = "data:image/png;base64," + (await sourceImage.png().toBuffer()).toString("base64");

    const distDir = path.join(projectDistDir, "icon");
    fs.ensureDirSync(distDir);
    fs.emptyDirSync(distDir);

    if (projectConfig.targets.android) {
      // Make Android icons

      const distAndroidDir = path.join(distDir, "android");
      fs.mkdirSync(distAndroidDir);

      const browser = await puppeteer.launch();

      const androidPresets: [string, number, number, number][] = [
        ["xxxhdpi", 192, 20, 8],
        ["xxhdpi", 144, 15, 7],
        ["xhdpi", 96, 10, 4],
        ["hdpi", 72, 7, 4],
        ["mdpi", 48, 5, 2]
      ];

      await Promise.all(androidPresets.map(async ([name, size, padding, radius]) => {
        logger.info(`Making Android icon: [${name}, ${size}, ${padding}, ${radius}]`);

        const page = await browser.newPage();
        await page.evaluate((sourceUrl: string, size: number, padding: number, radius: number) => {
          document.body.style.margin = "0";
          document.body.style.padding = `${padding}`;
          document.body.style.width = `${size}px`;
          document.body.style.height = `${size}px`;
          document.body.style.boxSizing = "border-box";

          const img = document.createElement("img");
          img.src = sourceUrl;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.borderRadius = `${radius * 2}px`;
          img.style.boxShadow = `0 0 ${radius}px #00000033`;

          document.body.appendChild(img);
        }, sourceImageURL, size, padding, radius);

        const image = await page.screenshot({
          omitBackground: true,
          clip: {
            x: 0, y: 0, width: size, height: size
          }
        }) as Buffer;

        const dir = `${distAndroidDir}/mipmap-${name}`;
        await fs.mkdir(dir, { recursive: true });
        await sourceImage.resize(size, size).png().toFile(`${dir}/ic_launcher_adaptive.png`);
        await fs.writeFile(`${dir}/ic_launcher.png`, image);
      }));

      await browser.close();
    }

    if (projectConfig.targets.ios) {
      // Make iOS icons

      const distiOSDir = path.join(distDir, "ios");
      fs.mkdirSync(distiOSDir);

      const iOSPresets: [string, number][] = [
        ["AppIcon20x20@2x.png", 40],
        ["AppIcon20x20@2x~ipad.png", 40],
        ["AppIcon20x20@3x.png", 60],
        ["AppIcon20x20~ipad.png", 20],
        ["AppIcon29x29@2x.png", 58],
        ["AppIcon29x29@2x~ipad.png", 58],
        ["AppIcon29x29@3x.png", 87],
        ["AppIcon29x29~ipad.png", 29],
        ["AppIcon40x40@2x.png", 80],
        ["AppIcon40x40@2x~ipad.png", 80],
        ["AppIcon40x40@3x.png", 120],
        ["AppIcon40x40~ipad.png", 40],
        ["AppIcon60x60@2x.png", 120],
        ["AppIcon60x60@3x.png", 180],
        ["AppIcon76x76@2x~ipad.png", 152],
        ["AppIcon76x76~ipad.png", 76],
        ["AppIcon83.5x83.5@2x~ipad.png", 167]
      ];

      await Promise.all(iOSPresets.map(
        async ([name, size]) => {
          logger.info(`Making iOS icon: [${name}, ${size}]`);
          await sourceImage.resize(size, size).png().toFile(`${distiOSDir}/${name}`);
        }
      ));
    }

    return true;
  }
};
