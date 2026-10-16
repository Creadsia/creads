import type { Db } from "./db";
import type { StorySettings } from "./historias";

// Reading and saving a story (an "ads" row with format "historia"; its shots are "clips" rows).

export async function loadStory(db: Db, adId: string) {
  const ad = await db.get("ads", adId);
  if (!ad || ad.format !== "historia") return null;
  const st = ad.settings as StorySettings | null;
  if (!st?.plan) return null;
  return { ad, st };
}

export const saveSettings = (db: Db, adId: string, st: StorySettings) => db.update("ads", adId, { settings: st as unknown as Record<string, unknown> });
