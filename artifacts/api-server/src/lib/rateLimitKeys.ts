import type { Request } from "express";

/**
 * The address a request is about, for limiters that should bound "how often
 * can this mailbox be targeted" rather than "how often can this building ask".
 *
 * Split out of routes/auth.ts so it can be unit-tested — same reason
 * `suspension.ts` and `passwordPolicy.ts` are separate files.
 *
 * The normalisation is the part that matters. A limit keyed on the raw string
 * would treat `Teacher@School.jo`, `teacher@school.jo` and ` teacher@school.jo `
 * as three separate buckets, so anyone wanting three times the allowance would
 * only have to hold the shift key — which is not a limit at all. It matches
 * how every route here looks the address up (`email.toLowerCase().trim()`),
 * so the bucket and the row it protects agree.
 */
export function emailKey(req: Pick<Request, "body">): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  const trimmed = typeof email === "string" ? email.toLowerCase().trim() : "";
  // Requests with no usable address share one bucket. They cannot reach a
  // handler anyway — every route keyed this way rejects a missing email — so
  // the shared bucket only ever throttles malformed traffic.
  return trimmed === "" ? "no-email" : trimmed;
}
