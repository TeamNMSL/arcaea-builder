import "./logger";
import { loadConfig } from "./config";
import { runAction } from "./action";

if (!("ARC_PROJECT" in process.env))
  logger.fatal("Please specify project directory with ARC_PROJECT env");

loadConfig(process.env["ARC_PROJECT"]);

const args = process.argv.slice(2);

if (args.length === 0)
  logger.fatal("Please specify action with argv");

runAction(args[0], args.slice(1)).then(() => process.exit(0));
