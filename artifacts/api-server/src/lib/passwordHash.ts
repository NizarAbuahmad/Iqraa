/**
 * Password hashing off the main thread.
 *
 * `bcryptjs` is pure JavaScript: at cost 12 one hash is ~0.35 s of CPU, and its
 * "async" API only yields between slices of that work — it still runs on the
 * thread that serves every request. Measured with e2e/loadtest: 100
 * simultaneous sign-ups took p95 36 s, and a `/healthz` that needs no database
 * took p95 35 s during the burst, so one sign-up rush stopped the whole Cloud
 * Run instance, including a class mid-exam.
 *
 * So the work runs in a worker thread (passwordHashWorker.ts, still bcryptjs:
 * same algorithm, same `$2b$12$…` hashes, every stored password keeps
 * verifying and nothing needs a migration). One worker by default, because the
 * API gets one vCPU: hashing is no faster, but the main thread keeps being
 * scheduled instead of starving.
 *
 * Three behaviours worth knowing:
 *
 * - **Admission, not just queueing.** One vCPU hashes ~3 passwords a second and
 *   the mobile client gives up after 15 s, so a request behind more than ~40
 *   others is abandoned work the worker would still do. `shedWhenHashingBusy`
 *   counts requests on hashing routes that have not finished and answers 503 +
 *   Retry-After beyond that, before the request costs a database lookup. It
 *   counts requests in flight, not the hash queue: a burst arrives all at once,
 *   before any of it has reached the hashing step, so a queue-depth check sees
 *   an empty queue and admits everything.
 * - **A worker that cannot start degrades, loudly, to the main thread.** A
 *   missing worker file (the build did not emit it) must not turn into nobody
 *   being able to sign in. It is logged at error level once and shows as
 *   `degraded: true` on /healthz/pool, because "works but blocks again" is
 *   exactly the failure that looks fine from every other angle.
 * - **A worker that dies mid-run is respawned**, and its job re-runs on the
 *   main thread; three such crashes degrade it for good.
 */
import { Worker } from "node:worker_threads";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { logger } from "./logger.ts";
import type { HashJob, HashReply } from "./passwordHashWorker.ts";

type Settled = string | boolean;
type Pending = {
  job: HashJob;
  resolve: (v: Settled) => void;
  reject: (e: Error) => void;
};
type Slot = { worker: Worker; current: Pending | null; proven: boolean; dead: boolean };

/** Whole number in [min, max] from an env string, else the fallback. */
function intFromEnv(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const n = Number(raw);
  return n >= min && n <= max ? n : fallback;
}

const MAX_CRASHES = 3;
/** Requests on hashing routes allowed in flight at once; see the header. */
const DEFAULT_MAX_PENDING = 40;

export function createPasswordHasher(opts: { workerUrl?: URL; workers?: number } = {}) {
  const workerUrl =
    opts.workerUrl ??
    new URL(`./passwordHashWorker${import.meta.url.endsWith(".ts") ? ".ts" : ".mjs"}`, import.meta.url);
  const size = opts.workers ?? intFromEnv(process.env["PASSWORD_HASH_WORKERS"], 1, 4, 1);

  const slots: Slot[] = [];
  const queue: Pending[] = [];
  let nextId = 1;
  let degraded = false;
  let crashes = 0;
  let completed = 0;
  let onMain = 0;
  let closing = false;

  function degrade(reason: string, err?: unknown) {
    if (degraded) return;
    degraded = true;
    logger.error(
      { err, reason },
      "password hashing worker unavailable — hashing on the MAIN THREAD again; a sign-up burst will now stall the API",
    );
  }

  /** The same work on the calling thread: bcryptjs's yielding API, as before this module existed. */
  async function runOnMain(job: HashJob): Promise<Settled> {
    onMain++;
    try {
      return job.op === "hash" ? await bcrypt.hash(job.password, job.rounds) : await bcrypt.compare(job.password, job.hash);
    } finally {
      onMain--;
    }
  }

  function rerunOnMain(p: Pending) {
    runOnMain(p.job).then(p.resolve, p.reject);
  }

  function spawn(): Slot | null {
    let worker: Worker;
    try {
      worker = new Worker(workerUrl);
    } catch (err) {
      degrade("spawn failed", err);
      return null;
    }
    worker.unref(); // referenced only while it holds a job, so an idle pool never keeps the process alive
    const slot: Slot = { worker, current: null, proven: false, dead: false };

    worker.on("message", (reply: HashReply) => {
      const p = slot.current;
      if (!p || p.job.id !== reply.id) return;
      slot.current = null;
      slot.proven = true;
      worker.unref();
      completed++;
      if (reply.ok) p.resolve(reply.result);
      else p.reject(new Error(reply.error));
      pump();
    });

    const onDead = (err?: unknown) => {
      if (slot.dead) return;
      slot.dead = true;
      const i = slots.indexOf(slot);
      if (i !== -1) slots.splice(i, 1);
      if (closing) {
        slot.current?.reject(new Error("password hasher closed"));
        return;
      }
      if (!slot.proven) {
        degrade("worker failed before completing a job", err);
      } else if (++crashes >= MAX_CRASHES) {
        degrade(`worker crashed ${crashes} times`, err);
      } else {
        logger.error({ err }, "password hashing worker died — respawning");
      }
      // The job it held is not lost: it runs here instead.
      if (slot.current) rerunOnMain(slot.current);
      slot.current = null;
      pump();
    };
    worker.on("error", onDead);
    worker.on("exit", () => onDead(new Error("worker exited")));

    slots.push(slot);
    return slot;
  }

  function pump() {
    while (queue.length > 0) {
      if (degraded) {
        // Everything that was waiting for a worker now runs here.
        rerunOnMain(queue.shift()!);
        continue;
      }
      let slot = slots.find((s) => s.current === null);
      if (!slot && slots.length < size) slot = spawn() ?? undefined;
      if (!slot) return; // every worker busy, or degraded just now (loop again)
      const p = queue.shift()!;
      slot.current = p;
      slot.worker.ref();
      slot.worker.postMessage(p.job);
    }
  }

  function submit(job: HashJob): Promise<Settled> {
    return new Promise<Settled>((resolve, reject) => {
      queue.push({ job, resolve, reject });
      pump();
    });
  }

  return {
    hash(password: string, rounds = 12): Promise<string> {
      return submit({ id: nextId++, op: "hash", password, rounds }) as Promise<string>;
    },
    compare(password: string, hash: string): Promise<boolean> {
      return submit({ id: nextId++, op: "compare", password, hash }) as Promise<boolean>;
    },
    status() {
      return {
        workers: slots.length,
        busyWorkers: slots.filter((s) => s.current).length,
        queued: queue.length,
        onMainThread: onMain,
        degraded,
        crashes,
        completed,
      };
    },
    async close() {
      closing = true;
      await Promise.all(slots.map((s) => s.worker.terminate()));
    },
  };
}

const hasher = createPasswordHasher();

/** Drop-in for `bcrypt.hash(password, 12)`. */
export const hashPassword = (password: string, rounds = 12) => hasher.hash(password, rounds);
/** Drop-in for `bcrypt.compare(password, hash)`. */
export const comparePassword = (password: string, hash: string) => hasher.compare(password, hash);

/**
 * Admission control for the routes that hash. One counter shared by all of
 * them, because they share the one CPU.
 */
export function createAdmission(limit: number) {
  let active = 0;
  return {
    active: () => active,
    middleware(_req: Request, res: Response, next: NextFunction): void {
      if (active >= limit) {
        res.setHeader("Retry-After", "3");
        res.status(503).json({ error: "Sign-in is busy right now. Please try again in a moment.", code: "hashing_busy" });
        return;
      }
      active++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        active--;
      };
      // 'close' covers a client that hung up before the response was written.
      res.once("finish", release);
      res.once("close", release);
      next();
    },
  };
}

const admission = createAdmission(intFromEnv(process.env["PASSWORD_HASH_MAX_PENDING"], 1, 5000, DEFAULT_MAX_PENDING));
/** For /healthz/pool: the worker's state plus how many hashing-route requests are in flight. */
export const hashingStatus = () => ({ ...hasher.status(), requestsInFlight: admission.active() });

/**
 * Put FIRST on a route that hashes — before its rate limiters and before auth.
 *
 * Order matters in both directions. Before the limiters, because a refused
 * request must cost the caller nothing: with the limiters first, "busy, try
 * again" burned the per-address allowance (3 registrations an hour) and a few
 * retries turned a busy server into a 429 lockout. Before auth, because the
 * point is to spend nothing — no limiter upsert, no user lookup — on a request
 * we are about to refuse. Abuse protection is unchanged: a request that is
 * admitted still passes every limiter, and a request a limiter rejects holds
 * its slot for milliseconds.
 *
 * Over the limit it answers 503 + Retry-After, which the clients treat as
 * "try again" (and now say so, instead of "login failed").
 */
export const shedWhenHashingBusy = () => admission.middleware;
