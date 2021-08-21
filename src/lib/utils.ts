import fs from "fs-extra";
import sharp from "sharp";
import mime from "mime-types";

export async function whenExist(filePath: string) {
  return await fs.pathExists(filePath) ? await fs.readFile(filePath) : null;
}

export async function createDataUriForImage(image: Buffer) {
  const meta = await sharp(image).metadata();
  return `data:${mime.lookup(meta.format)};base64,${image.toString("base64")}`;
}
