/**
 * Which client a request came from (android | ios | web), carried to wherever
 * an `ai_generations` row is written without threading it through every
 * generator. The app sends `X-Iqraa-Platform` on every call (mobile
 * services/clientPlatform.ts); anything else — a cron job, an old build, curl —
 * is null, and the admin screens call that «unknown».
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { signupSource } from "./adminMetrics.ts";

const store = new AsyncLocalStorage<{ platform: string | null }>();

/** The platform of the request in flight, or null outside one / when unsaid. */
export function currentPlatform(): string | null {
  return store.getStore()?.platform ?? null;
}

export function platformContext(req: Request, _res: Response, next: NextFunction): void {
  store.run({ platform: signupSource(req.headers).signupPlatform }, next);
}
