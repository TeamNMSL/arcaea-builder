import fs from "fs-extra";
import tempy from "tempy";
import { execPiped } from "./exec";

async function ffmpeg(music: Buffer, filters: string[], extra?: string[]): Promise<Buffer> {
  const tempFile = await tempy.write(music);
  const result = await execPiped("ffmpeg", [
    "-f", "ogg", "-i", tempFile,
    ...extra || [],
    ...filters?.length ? ["-filter:a", filters.join(',')] : [],
    "-bitexact",
    "-f", "ogg", "pipe:1"
  ]);
  await fs.remove(tempFile);
  return result;
}

export async function tempoScale(music: Buffer, factor: number): Promise<Buffer> {
  const originalRate = 44100;
  return await ffmpeg(music, [`aresample=${originalRate}/(${factor})`, `atempo=${factor}`]);
}

export async function cutMusic(music: Buffer, start: number, end: number): Promise<Buffer> {
  return await ffmpeg(music, null, ["-ss", `${start}ms`, "-to", `${end}ms`]);
}

export async function makePreview(music: Buffer, start: number, end: number): Promise<Buffer> {
  const fadeInDuration = 900;
  const fadeOutDuration = 3000;

  return await ffmpeg(
    music,
    [
      `afade=t=in:st=${start}ms:d=${fadeInDuration}ms:curve=ihsin`,
      `afade=t=out:st=${end - fadeOutDuration}ms:d=${fadeOutDuration}ms:curve=isinc`
    ],
    ["-ss", `${start}ms`, "-to", `${end}ms`]
  );
}
