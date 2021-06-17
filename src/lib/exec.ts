import child_process from "child_process";

import { ProjectConfig } from "@/config";

export async function exec(tool: keyof ProjectConfig["tools"], args: string[]) {
  const argv = [tool, ...args];
  logger.info(`Execuating [${argv.map(s => JSON.stringify(s)).join(", ")}]`);
  child_process.execFileSync(argv[0], argv.slice(1), {
    shell: false,
    stdio: "inherit",
  });
}
