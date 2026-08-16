// At least 8 characters with a letter and a digit — blocks the weakest
// passwords (all-digit, dictionary words) without demanding a symbol, which
// would just push pilot teachers toward writing passwords down.
const STRONG_PASSWORD = /(?=.*\p{L})(?=.*\d).{8,}/u;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include both a letter and a number";

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD.test(password);
}
