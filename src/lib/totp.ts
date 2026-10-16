import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Two-step verification codes (TOTP, RFC 6238): the 6-digit codes of Google Authenticator,
// Authy, 1Password and the like. 30-second steps; one step of clock drift is accepted.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret() {
  const bytes = randomBytes(20);
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string) {
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  let bits = "";
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error("bad secret");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The code for a moment in time (exported for tests). */
export function codeAt(secret: string, ms: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(ms / 1000 / 30)));
  const h = createHmac("sha1", decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** True if `code` is valid now (or one step before/after). */
export function verifyCode(secret: string, code: string, now = Date.now()) {
  const c = String(code ?? "").replace(/\D/g, "");
  if (c.length !== 6 || !secret) return false;
  let ok = false;
  for (const step of [-1, 0, 1]) {
    const want = Buffer.from(codeAt(secret, now + step * 30_000));
    ok = timingSafeEqual(want, Buffer.from(c)) || ok;
  }
  return ok;
}

/** The link authenticator apps read from the QR code. */
export const otpauthUrl = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`Creads IA:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("Creads IA")}&algorithm=SHA1&digits=6&period=30`;
