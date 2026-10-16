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

/**
 * Changes a story from its latest saved version (reloaded just before writing), so two jobs that finish
 * at the same time (e.g. two character sheets) don't erase each other's result.
 */
export async function updateStory(db: Db, adId: string, change: (st: StorySettings) => void) {
  const fresh = await loadStory(db, adId);
  if (!fresh) throw new Error("Historia no encontrada.");
  change(fresh.st);
  await saveSettings(db, adId, fresh.st);
  return fresh.st;
}
