/**
 * The thread bcrypt actually runs on. See passwordHash.ts for why it exists.
 *
 * The sync API on purpose: this thread has nothing else to do, and bcryptjs's
 * async variant only adds the yielding that protects a main thread.
 */
import { parentPort } from "node:worker_threads";
import bcrypt from "bcryptjs";

if (!parentPort) throw new Error("passwordHashWorker must be started as a worker thread");
const port = parentPort;

export type HashJob =
  | { id: number; op: "hash"; password: string; rounds: number }
  | { id: number; op: "compare"; password: string; hash: string };

export type HashReply = { id: number; ok: true; result: string | boolean } | { id: number; ok: false; error: string };

port.on("message", (job: HashJob) => {
  try {
    const result = job.op === "hash" ? bcrypt.hashSync(job.password, job.rounds) : bcrypt.compareSync(job.password, job.hash);
    port.postMessage({ id: job.id, ok: true, result } satisfies HashReply);
  } catch (err) {
    port.postMessage({ id: job.id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies HashReply);
  }
});
