import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { z } from "zod";

/**
 * Password hashing with scrypt (built into Node). Parameters follow OWASP's
 * recommendation N=2^15, r=8, p=3 (32 MiB per hash). They are stored with each
 * hash, so they can be raised later without breaking existing passwords.
 * Tests may lower the cost with PASSWORD_HASH_LOG_N.
 */
const LOG_N = Number(process.env.PASSWORD_HASH_LOG_N ?? 15);
const PARAMS = { N: 2 ** LOG_N, r: 8, p: 3 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  try {
    const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spends the same time as a real check, so a wrong email can't be told apart from a wrong password. */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "11111111", "00000000",
  "qwertyui", "qwerty123", "qwertyuiop", "iloveyou", "abcd1234", "abc12345", "letmein1", "welcome1",
  "admin123", "india123", "thapar123", "patiala1", "junto123", "sunshine", "princess", "football",
]);

/** Rules for a new password (sign-up, reset, change). */
export const newPasswordSchema = z
  .string()
  .max(128, "Keep it under 128 characters.")
  .refine((v) => v.trim().length >= 8, "Use at least 8 characters.")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "That password is too common. Pick something harder to guess.");
