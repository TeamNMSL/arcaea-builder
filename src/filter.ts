import url from "url";
import vibrant from "node-vibrant";

import { SongData } from "./lib/interfaces";

import { filter as filterCut } from "./filters/cut";
import { filter as filterChartFixSpeed } from "./filters/chart-fix-speed";
import { filter as filterTempoScale } from "./filters/tempo-scale";
import { createBrowserContext } from "./lib/browser";
import { createDataUriForImage } from "./lib/utils";

export interface Filter<Options = {}> {
  filter: (song: SongData, options?: Options) => Promise<void>;
  getAppendedText?: (type: "Title" | "CoverImage", song: SongData, options?: Options) => string;
}

const filters: Record<string, Filter<unknown>> = {
  cut: filterCut,
  chartFixSpeed: filterChartFixSpeed,
  tempoScale: filterTempoScale
};

export interface FilterOptions {
  name: string;
}

export async function applyFilters(song: SongData, filterOptions: FilterOptions[]) {
  const titleAppendedTexts: string[] = [];
  const coverTexts: string[] = [];
  for (const { name, ...options } of filterOptions) {
    const filter = filters[name];
    if (!filter)
      throw new Error(`Unknown filter: ${JSON.stringify(name)}`);

    await filter.filter(song, options);
    if (filter.getAppendedText) {
      titleAppendedTexts.push(filter.getAppendedText("Title", song, options));
      coverTexts.push(filter.getAppendedText("CoverImage", song, options));
    }
  }

  const titleAppendedText = titleAppendedTexts.join(', ');
  if (titleAppendedText) {
    for (const lang of Object.keys(song.meta.title_localized))
      song.meta.title_localized[lang] += ` (${titleAppendedText})`;
  }

  const nonEmptycoverTexts = coverTexts.filter(s => s);
  if (nonEmptycoverTexts.length) {
    song.baseCover256 = null;
    song.baseCover = await appleFilterCoverText(song.baseCover, nonEmptycoverTexts); 
    for (const difficulty of Object.values(song.difficulties)) {
      difficulty.cover256 = null;
      if (difficulty.cover)
        difficulty.cover = await appleFilterCoverText(difficulty.cover, nonEmptycoverTexts); 
    }
  }
}

async function appleFilterCoverText(image: Buffer, texts: string[]) {
  const IMAGE_SIZE = 512;
  
  const imagePalette = await vibrant.from(image).getPalette();
  const coverBackgroundColor = imagePalette.Vibrant.rgb;
  const coverTextColor = imagePalette.DarkVibrant.hex;

  const context = await createBrowserContext();
  const imageUrl = await createDataUriForImage(image);
  await context.evaluate((imageUrl: string, size: number, fontCssUrl: string, coverBackgroundColor: number[], coverTextColor: string, text: string) => {
    document.body.style.margin = "0";
    document.body.style.width = `${size}px`;
    document.body.style.height = `${size}px`;
    document.body.style.position = 'relative';
    document.body.style.boxSizing = "border-box";

    const fontCssLink = document.createElement('link');
    fontCssLink.rel = 'stylesheet';
    fontCssLink.href = fontCssUrl;
    document.head.appendChild(fontCssLink);

    const image = document.createElement('img');
    image.src = imageUrl;
    image.style.width = '100%';
    image.style.height = '100%';
    document.body.appendChild(image);

    const overlayDiv = document.createElement('div');
    const coverBackgroundRgba = `rgba(${coverBackgroundColor.join(', ')}, 0.3)`;
    overlayDiv.style.position = 'absolute';
    overlayDiv.style.left = '0';
    overlayDiv.style.bottom = '0';
    overlayDiv.style.width = `${size}px`;
    overlayDiv.style.background = coverBackgroundRgba;
    overlayDiv.style.boxShadow = `0 0 10px ${coverBackgroundRgba}`;
    overlayDiv.style.color = coverTextColor;
    overlayDiv.style.whiteSpace = 'pre-wrap';
    overlayDiv.style.fontFamily = 'Exo';
    overlayDiv.style.fontSize = '30px';
    overlayDiv.style.fontWeight = '600';
    overlayDiv.style.lineHeight = '1.4';
    overlayDiv.style.textAlign = 'center';
    overlayDiv.style.padding = '15px 0';
    overlayDiv.style.letterSpacing = '1px';
    overlayDiv.style["backdropFilter"] = 'blur(4px)';
    overlayDiv.style.textShadow = '0 0 4px #fff';
    overlayDiv.innerText = text;
    document.body.appendChild(overlayDiv);
  }, imageUrl, IMAGE_SIZE, url.pathToFileURL(require.resolve('@fontsource/exo/index.css')).toString(), coverBackgroundColor, coverTextColor, texts.join('\n'));
  
  return await context.screenshot({
    omitBackground: true,
    clip: {
      x: 0, y: 0, width: IMAGE_SIZE, height: IMAGE_SIZE
    }
  }) as Buffer;
}
