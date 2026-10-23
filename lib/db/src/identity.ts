import { AsyncLocalStorage } from "node:async_hooks";

/** Who a request is acting as. Set once by authMiddleware; read by ScopedPool. */
export interface Identity {
  userId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_RE = /^[a-z_]{1,32}$/;

const store = new AsyncLocalStorage<Identity>();

/**
 * Throws unless both fields are safe to write into a simple query. `asUser` calls it, and so
 * does `ScopedPool#openScope`, which takes an Identity directly and must not rely on a caller
 * having gone through `asUser`.
 */
export function assertValidIdentity(identity: Identity): void {
  if (!UUID_RE.test(identity.userId)) throw new Error("asUser: userId is not a uuid");
  if (!ROLE_RE.test(identity.role)) throw new Error("asUser: role must be lower_snake_case");
}

/**
 * Run `fn` — and everything it awaits — as `identity`.
 *
 * Both fields are checked here because ScopedPool writes them into a
 * multi-statement simple query, where bind parameters are not available. A
 * value that passes these two patterns cannot carry SQL.
 */
export function asUser<T>(identity: Identity, fn: () => T): T {
  assertValidIdentity(identity);
  return store.run({ userId: identity.userId.toLowerCase(), role: identity.role }, fn);
}

/** The identity of the request in flight, or undefined outside one. */
export function currentIdentity(): Identity | undefined {
  return store.getStore();
}
