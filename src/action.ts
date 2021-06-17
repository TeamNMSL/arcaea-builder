import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";

export interface Action {
  action: (args: string[]) => Promise<boolean>;
  dependencies: string[];
}

export function getAction(name: string): Action {
  return require(`./actions/${name}`).action;
}

export async function runAction(name: string, args: string[]) {
  const action = getAction(name);

  if (!action)
    logger.fatal("No such action: " + name);

  let progress = new Set<string>();
  const progressFile = path.join(projectDistDir, "progress.yaml");
  if (!fs.pathExistsSync(projectDistDir)) {
    fs.mkdirSync(projectDistDir);
  } else {
    if (fs.pathExistsSync(progressFile))
      progress = new Set(yaml.load(fs.readFileSync(progressFile, "utf-8")) as string[]);
  }

  for (const dep of action.dependencies) {
    if (!progress.has(dep))
      logger.fatal(`Requested action "${name}", but the required action "${dep}" has not been run.`);
  }

  try {
    if (!await action.action(args))
      logger.fatal(`Action "${name}" failed.`);
  } catch (e) {
    logger.fatal(`Action "${name}" failed with an exception: ${e.stack}`);
  }
  
  progress.add(name);
  fs.writeFileSync(progressFile, yaml.dump(Array.from(progress)));
}
