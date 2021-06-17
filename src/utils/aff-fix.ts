import fs from "fs";

export default (args: string[]) => {
  const write = args[0] === "-w";
  const chartFiles = write ? args.slice(1) : args;
  
  const regexes = [
    [/arc\(([\S\s]+?)\)/g, "arc(", ")", [0, 1, 7], [2, 3, 5, 6]],
    [/camera\(([\S\s]+?)\)/g, "camera(", ")", [0, 8], [1, 2, 3, 4, 5, 6]],
    [/timing\(([\S\s]+?)\)/g, "timing(", ")", [0], [1, 2]]
  ] as const;
  
  function fix(s: string, n: number) {
    const sign = s.startsWith("-");
    const x = Number(sign ? s.slice(1) : s);
    return (sign ? "-" : "") + x.toFixed(n);
  }
  
  for (const filename of chartFiles) {
    const chart = fs.readFileSync(filename, "utf-8");
    let fixed = chart;
    regexes.forEach(([regex, prefix, suffix, integers, decimals]) => {
      fixed = fixed.replace(regex, (_, s) => {
        const a = s.split(",");
        for (const i of integers) a[i] = fix(a[i], 0);
        for (const i of decimals) a[i] = fix(a[i], 2);
  
        // "timing() with 0.00 beats" fix
        if (prefix === "timing(" && a[2] === "0.00") a[2] = "9999999.00";
  
        return `${prefix}${a.join(",")}${suffix}`;
      });
    });
  
    if (chart.trim() !== fixed.trim()) {
      logger.info(`Fixed ${filename}`);
      if (write) fs.writeFileSync(filename, fixed);
    }
  }

  if (!write) {
    logger.warn("Changes NOT written to disk");
    logger.warn("Append -w argument before ALL chart files to write fixed chart files back");
  }
};
