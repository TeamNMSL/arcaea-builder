import { ProjectConfig, BinaryPatchConfig } from "./config";
import { Logger } from "./logger";

declare global {
  const projectDir: string;
  const projectOriginalDir: string;
  const projectPacksDir: string;
  const projectDistDir: string;

  const projectConfig: ProjectConfig;
  const binaryPatchConfig: BinaryPatchConfig;

  const logger: Logger;
}
