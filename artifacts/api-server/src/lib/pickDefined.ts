/**
 * Copy the keys a PATCH body actually sent.
 *
 * PATCH bodies are partial: a key that is absent means "leave it alone", and a
 * key set to `null` means "clear it". Those are different requests and the
 * difference is one `!== undefined`. Hand-written per-field `if` chains get it
 * right until someone adds a nullable field and reaches for truthiness — at
 * which point setting the field works, clearing it silently does nothing, and
 * nothing errors.
 *
 * One function, one rule, one test.
 */
export function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    // `null` is a value the caller meant to send. Only `undefined` — the key
    // was not in the body at all — is skipped.
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
