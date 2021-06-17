import { ProjectConfig } from "@/config";

type PackCategory = keyof ProjectConfig["packs"];

export function index(category: PackCategory) {
  if (!(category in projectConfig.packs))
    // No such pack category
    return 0xFF;

  return ({
    free: 0, // The "free" category's divider's index must be 0
    story: projectConfig.packs.free.length,
    sidestory: projectConfig.packs.free.length + (projectConfig.packs.story || []).length,
    collab: projectConfig.packs.free.length + (projectConfig.packs.story || []).length + (projectConfig.packs.sidestory || []).length,
  } as const)[category];
}
