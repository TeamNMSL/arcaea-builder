import { filterChart } from "@/lib/filterChart";
import { Filter } from "@/filter";
import { cutMusic, makePreview } from "@/lib/audioUtils";

interface FilterCutOptions {
  start: number;
  end: number;
}

export const filter: Filter<FilterCutOptions> = {
  async filter(song, options) {
    const previewInPart = song.meta.audioPreview == null || (song.meta.audioPreview >= options.start && song.meta.audioPreviewEnd <= options.end);
    if (!previewInPart && !song.preview) {
      // If the preview will be affected by the cut, generate preview first
      song.preview = await makePreview(song.music, song.meta.audioPreview, song.meta.audioPreviewEnd);
      song.meta.audioPreview = song.meta.audioPreviewEnd = null;
    }

    if (previewInPart && song.meta.audioPreview != null) {
      // Calculate the new range of preview
      song.meta.audioPreview -= options.start;
      song.meta.audioPreviewEnd -= options.start;
    }

    song.music = await cutMusic(song.music, options.start, options.end);
    for (const difficulty of Object.values(song.difficulties)) {
      // TODO: add fade in and fade out?
      difficulty.chart = filterChart(difficulty.chart, options.start, options.end, 1, 0);
    }
  },
  getAppendedText(type, song, options) {
    function formatTime(time: number) {
      const m = Math.floor(time / 1000 / 60);
      const s = Math.floor(time / 1000) % 60;
      const ms = time % 1000;

      const stringM = m.toString().padStart(2, '0');
      const stringS = s.toString().padStart(2, '0');
      const stringMS = ms.toString().padStart(3, '0');
      
      const mAndS = `${stringM}:${stringS}`;
      return !ms ? mAndS : `${mAndS}.${stringMS}`;
    }

    const cutRange = `${formatTime(options.start)} - ${formatTime(options.end)}`;
    return type === "CoverImage" ? `Time ${cutRange}` : cutRange;
  }
}
