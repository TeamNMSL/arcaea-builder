import { filterChart } from "@/lib/filterChart";
import { Filter } from "@/filter";
import { tempoScale } from "@/lib/audioUtils";

interface FilterCutOptions {
  factor: number;
}

export const filter: Filter<FilterCutOptions> = {
  async filter(song, options) {
    if (!(options.factor >= 0.5 && options.factor <= 2))
      throw new Error(`Invalid tempo scale factor ${options.factor} (valid range is 0.5 - 2)`);

    if (song.meta.audioPreview != null) {
      song.meta.audioPreview = Math.round(song.meta.audioPreview / options.factor);
      song.meta.audioPreviewEnd = Math.round(song.meta.audioPreviewEnd / options.factor);
    }

    if (song.preview) {
      song.preview = await tempoScale(song.preview, options.factor);
    }

    song.music = await tempoScale(song.music, options.factor);
    for (const difficulty of Object.values(song.difficulties)) {
      difficulty.chart = filterChart(difficulty.chart, 0, Infinity, options.factor, 0);
    }

    song.meta.bpm_base *= options.factor;
    song.meta.bpm = song.meta.bpm.replace(/\d+/g, x => String(Math.round(Number(x) * options.factor)));
  },
  getAppendedText(type, song, options) {
    const factor = `${options.factor}x`;
    return type === "CoverImage" ? `Speed ${factor}` : factor;
  }
}
