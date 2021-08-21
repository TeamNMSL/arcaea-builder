import v8 from "v8";
import path from "path";
import fs from "fs-extra";
import walk from "klaw";

export function getDirectoryLastModifiedTime(directory: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let result = 0;
    walk(directory).on('error', error => reject(error)).on('data', item => result = Math.max(result, item.stats.mtimeMs)).on('end', () => resolve(result));
  });
}

export async function withCache<T>(key: string, sourceModifiedTime: number, computeData: () => Promise<T>): Promise<T> {
  const cacheDir = path.join(projectDistDir, "cache");
  const cacheName = key.split('/').join('_');
  const cacheFilePath = path.join(cacheDir, cacheName);
  try {
    const cacheStat = await fs.stat(cacheFilePath);
    if (sourceModifiedTime <= cacheStat.mtimeMs) {
      const cacheData = await fs.readFile(cacheFilePath);
      return v8.deserialize(cacheData);
    }
  } catch (e) {}

  const data = await computeData();
  await fs.ensureDir(cacheDir);
  await fs.writeFile(cacheFilePath, v8.serialize(data));
  return data;
}
