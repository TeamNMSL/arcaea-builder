import child_process from "child_process";
import streamToArray from "stream-to-array";

import { ProjectConfig } from "@/config";

type Tool = keyof ProjectConfig["tools"];

function getTool(tool: Tool) {
  return projectConfig.tools[tool] || tool;
}

export async function exec(tool: Tool, args: string[]) {
  const argv = [getTool(tool), ...args];
  logger.info(`Execuating [${argv.map(s => JSON.stringify(s)).join(", ")}]`);
  child_process.execFileSync(argv[0], argv.slice(1), {
    shell: false,
    stdio: "inherit",
  });
}

export async function execPiped(tool: Tool, args: string[]): Promise<Buffer> {
  const argv = [getTool(tool), ...args];
  logger.info(`Execuating [${argv.map(s => JSON.stringify(s)).join(", ")}]`);
  const process = child_process.spawn(argv[0], argv.slice(1), {
    shell: false,
    stdio: ["ignore", "pipe", "ignore"]
  });
  const result = Buffer.concat(await streamToArray(process.stdout));
  return result;
}
