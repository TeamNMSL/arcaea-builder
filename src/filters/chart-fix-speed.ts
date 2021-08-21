import { Filter } from "../filter";

export const filter: Filter = {
  async filter(song) {
    for (const difficulty of Object.values(song.difficulties)) {
      const bpm = song.meta.bpm_base.toFixed(2);
      difficulty.chart = difficulty.chart.replace(/timing\(([\S\s]+?)\)/g, (_, s) => {
        const a = s.split(",");
        a[1] = bpm;
        return `timing(${a.join(",")})`;
      });
    }
  }
};
