const expressions: [name: string, regex: RegExp, startIndex: number, endIndex: number][] = [
  ["", /^\(([\S\s]+?)\)/gm, 0, 0],
  ["flick", /^flick\(([\S\s]+?)\)/gm, 0, 0],
  ["hold", /^hold\(([\S\s]+?)\)/gm, 0, 1],
  ["arc", /^arc\(([\S\s]+?)\)/gm, 0, 1],
  ["scenecontrol", /^scenecontrol\(([\S\s]+?)\)/gm, 0, 0]
];

export function filterChart(chart: string, cutStart: number, cutEnd: number, scale: number, offset: number) {
  function mapTime(time: number) {
    return Math.round((time - cutStart) / scale + offset);
  }
  const end = mapTime(cutEnd);

  function processArcTaps(line: string) {
    if (!line.startsWith("arc(")) return line;

    // arc(...)[arctap(X),arctap(X),...];
    const arcTapsStartIndex = line.indexOf('[');
    if (arcTapsStartIndex === -1) return line;

    const lineBeforeArcTaps = line.slice(0, arcTapsStartIndex);
    const arcTapExpressions = line.slice(arcTapsStartIndex + 1, line.length - 2).split(',');
    const arcTaps = arcTapExpressions.map(expr => Number(expr.slice(expr.indexOf('(') + 1, expr.length - 1)));
    const processedArcTaps = arcTaps.map(mapTime).filter(x => x > 0 && x <= end);
    return lineBeforeArcTaps + (processedArcTaps.length === 0 ? ';' : ('[' + processedArcTaps.map(x => `arctap(${x})`) + '];'));
  }

  function processChartMeta(chartMetaLines: string[]) {
    return chartMetaLines.map(line => {
      if (line.startsWith("AudioOffset:")) return line.replace(/\d+/, s => String(Number(s) / scale));
      return line;
    });
  }

  function processBlock(lines: string[]) {
    for (const i of lines.keys()) {
      let line = lines[i];
      let skipLine = false;
  
      line = processArcTaps(line);
      for (const [name, regex, startIndex, endIndex] of expressions) {
        line = line.replace(regex, (_, s: string) => {
          const args = s.split(",");
          let startTime = mapTime(Number(args[startIndex]));
          let endTime = mapTime(Number(args[endIndex]));
          
          if (startTime > end || endTime < 0) {
            skipLine = true;
            return "";
          }
          
          if (startTime < 0) startTime = 0;
          if (endTime > end) endTime = end;
  
          args[startIndex] = String(startTime);
          args[endIndex] = String(endTime);
  
          return `${name}(${args.join(",")})`;
        });
      }
  
      lines[i] = skipLine ? "" : line;
    }
  
    // Process timing() and camera()
  
    type Timing = [time: number, bpm: string, beats: string];
    const timings: Timing[] = [];
    for (const i of lines.keys()) {
      let line = lines[i];
  
      // Remove camera()
      if (line.startsWith("camera")) {
        lines[i] = "";
        continue;
      }
  
      // Extract all timing()s
      if (line.startsWith("timing")) {
        const args = line.substring(line.indexOf('(') + 1, line.lastIndexOf(')')).split(',');
        timings.push([mapTime(Number(args[0])), (Number(args[1]) * scale).toFixed(2), args[2]]);
        lines[i] = "";
        continue;
      }
    }
  
    // Remove out-of-range timing()s and set the nearest negative-timed timing() to 0
    let newFirstTiming: Timing = null;
    for (const timing of timings)
      if (!newFirstTiming || (timing[0] <= 0 && timing[0] >= newFirstTiming[0]))
        newFirstTiming = timing;
    newFirstTiming[0] = 0;
  
    const newTimings = [newFirstTiming, ...timings.filter(([time]) => time > 0 && time <= end)];
    const newTimingLines = newTimings.map(timing => `timing(${timing.join(",")});`);
  
    return [...newTimingLines, ...lines.filter(s => s)];
  }

  const lines = chart.trim().split('\n').map(line => line.trim()).filter(line => line);
  const dividerLineIndex = lines.indexOf('-');
  const chartMetaLines = processChartMeta(lines.slice(0, dividerLineIndex));
  const chartLines = lines.slice(dividerLineIndex + 1);

  const mainBlockLines: string[] = [];
  const timingGroups: string[] = [];
  for (let i = 0; i < chartLines.length; ) {
    if (chartLines[i].startsWith("timinggroup(")) {
      const endLineIndex = chartLines.indexOf("};", i + 1);
      const timingGroupBlockLines = chartLines.slice(i + 1, endLineIndex);
      const processedTmingGroupBlockLines = processBlock(timingGroupBlockLines);
      timingGroups.push([
        chartLines[i],
        ...processedTmingGroupBlockLines.map(line => `  ${line}`),
        chartLines[endLineIndex],
      ].join('\n'));

      i = endLineIndex + 1;
    } else {
      mainBlockLines.push(chartLines[i]);
      i++;
    }
  }

  const processedMainBlockLines = processBlock(mainBlockLines);
  
  return [
    ...chartMetaLines,
    '-',
    ...processedMainBlockLines,
    ...timingGroups,
  ].join('\n') + '\n';
}
