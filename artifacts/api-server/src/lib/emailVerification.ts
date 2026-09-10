import crypto from "crypto";

/** 6 digits, always — `Math.random` would do, but `randomInt` is the CSPRNG already used for refresh tokens (see auth.ts). */
export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Same shape as the refresh-token hash in auth.ts — never store the code itself. */
export function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;

/** A 6-digit code is 1e6 possibilities — cap guesses per token well below that. */
export const VERIFICATION_MAX_ATTEMPTS = 5;
