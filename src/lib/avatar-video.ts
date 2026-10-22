// «Persona real»: an avatar can carry a video of the real person talking to the camera (filmed with their
// permission). It lives in the avatar's `notes` (a small JSON that already holds other markers), so no new
// column is needed. Shared by the studio and the server (no server-only code here).

/** The avatar's notes as an object ({} when empty or plain text). */
export function notesOf(notes: unknown): Record<string, unknown> {
  if (typeof notes !== "string" || !notes.trim().startsWith("{")) return {};
  try {
    const o = JSON.parse(notes);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The person's own video, if the avatar has one. */
export function avatarVideo(notes: unknown): string | null {
  const v = notesOf(notes).video;
  return typeof v === "string" && v ? v : null;
}

/** The notes with the video set (or removed with null), keeping every other marker. */
export function withVideo(notes: unknown, video: string | null): string {
  const o = { ...notesOf(notes) };
  if (video) o.video = video;
  else delete o.video;
  return JSON.stringify(o);
}

/**
 * Where in the person's video each cut starts, so consecutive cuts don't open on the same frame.
 * Deterministic (the same cut always starts at the same place); 0 when the video is too short.
 */
export function actorOffset(idx: number, videoSecs: number, cutSecs: number): number {
  const room = videoSecs - cutSecs - 0.2;
  if (!(room > 0.5)) return 0;
  return +(((idx * 5.3) % room)).toFixed(2);
}
