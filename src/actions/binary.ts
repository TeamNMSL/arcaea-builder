import fs from "fs-extra";
import path from "path";

import { Action } from "@/action";

// For patching pack dividers, used in eval()
import * as packDivider from "@/lib/packDivider";
packDivider.index;

type Patcher = (buffer: Buffer, address: number, argument: string) => Buffer;

const patchers: Record<string, Patcher> = {
  HEX: (buffer, address, argument) => {
    const normalized = argument.split(" ").join("").toLowerCase();
    const data = Buffer.from(normalized, "hex");
    if (normalized !== data.toString("hex")) logger.fatal(`Invalid hex sequence "${argument}"`);
    return data;
  },
  ASCIIZ: (buffer, address, argument) => {
    return Buffer.from(argument + "\0", "ascii");
  },
  UINT: (buffer, address, argument) => {
    const [strLength, endian, strX] = argument.split(" ");
    if (!["32", "16", "8"].includes(strLength)) logger.fatal(`UINT's length must be 32, 16 or 8, got ${JSON.stringify(strLength)}`);
    if (!["LE", "BE"].includes(endian)) logger.fatal(`UINT's endian must be 32, 16 or 8, got ${JSON.stringify(endian)}`);

    const length = Number(strLength), x = Number(strX);
    if (!(Number.isSafeInteger(x) && x >= 0 && x < 2 ** length)) logger.fatal(`Invalid ${strLength}-bit uint ${strX}`);

    const data = Buffer.allocUnsafe(length / 8);
    if (length === 32 && endian === "LE")
      data.writeUInt32LE(x);
    else if (length === 32 && endian === "BE")
      data.writeUInt32BE(x);
    else if (length === 16 && endian === "LE")
      data.writeUInt16LE(x);
    else if (length === 16 && endian === "BE")
      data.writeUInt16BE(x);
    else if (length === 8)
      data.writeUInt8(x);
    else
      logger.fatal(`This shouldn't happen!`);

    return data;
  },
  EVAL: (buffer, address, argument) => {
    return resolvePatchData(buffer, address, eval(argument));
  }
};

function resolvePatchData(buffer: Buffer, address: number, expression: string) {
  const i = expression.indexOf(" ");
  if (i === -1) logger.fatal(`Invalid binary patch expression: ${expression}`);

  const type = expression.substr(0, i);
  const argument = expression.substr(i + 1);
  if (!patchers[type]) logger.fatal(`Invalid binary patch type "${type}" in expression: ${expression}`);

  return patchers[type](buffer, address, argument);
}

function doPatch(buffer: Buffer, address: number, expression: string) {
  const data = resolvePatchData(buffer, address, expression);
  logger.info(`Data expression at 0x${address.toString(16)} ${JSON.stringify(expression)} resolved to ${data.toString("hex")}`);
  data.copy(buffer, address);
}

export const action: Action = {
  dependencies: ["unpack"],
  action: async () => {
    async function runPatch(target: "android" | "ios", originalBinaryPath: string) {
      logger.info(`Patching target ${target}`);

      const binary = await fs.readFile(originalBinaryPath);
      
      const patchList = binaryPatchConfig.targets[target];
      
      for (const hexAddress in patchList) {
        const address = parseInt(hexAddress, 16);
        const expression = patchList[hexAddress];
        doPatch(binary, address, expression);
      }
      
      const binaryDirectory = path.join(projectDistDir, "binary");
      await fs.ensureDir(binaryDirectory);
      const binaryPath = path.join(binaryDirectory, target);
      await fs.writeFile(binaryPath, binary);
    }

    await runPatch("android", path.join(projectOriginalDir, "package/lib/armeabi-v7a/libcocos2dcpp.so"));
    await runPatch("ios", path.join(projectOriginalDir, "Payload/Arc-mobile.app/Arc-mobile"));

    return true;
  }
};
