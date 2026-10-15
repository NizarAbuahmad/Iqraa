/**
 * Wait for a push before answering the request — but not for long, and never
 * let it fail the request.
 *
 * Cloud Run throttles a revision's CPU once the response has been sent
 * (deploy.yml does not pass --no-cpu-throttling), so work left running after
 * `res.json` — the old fire-and-forget pattern — can stall until the next
 * request arrives. Teacher actions that tell families something therefore
 * await it here, capped: past `ms` the request answers anyway and the work
 * carries on as best it can. Errors are logged, never thrown.
 */
import { logger } from "./logger.ts";

export const FAMILY_PUSH_WAIT_MS = 4_000;

export async function pushWithin(label: string, work: () => Promise<unknown>, ms: number = FAMILY_PUSH_WAIT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // `Promise.resolve().then(work)` turns a synchronous throw into a rejection,
  // and the second `then` handles it, so `running` never rejects — not even
  // after the cap, when nothing is awaiting it any more.
  const running = Promise.resolve()
    .then(work)
    .then(
      () => "done" as const,
      err => {
        logger.error({ err, label }, "family push failed");
        return "failed" as const;
      },
    );
  const capped = new Promise<"capped">(resolve => {
    timer = setTimeout(() => resolve("capped"), ms);
  });
  const outcome = await Promise.race([running, capped]);
  clearTimeout(timer);
  if (outcome === "capped") logger.warn({ label, ms }, "family push still running when the response went out");
}
