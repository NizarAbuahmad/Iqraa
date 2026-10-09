/**
 * Write to a student's paper only while it is still open, under its row lock.
 *
 * The save routes used to check `attempt.submittedAt` on a row read at the top
 * of the request and then upsert the answer later. A save that read the paper
 * as open, then lost the race to a hand-in, landed *after* grading had already
 * read the answers — a changed paper with a stale mark.
 *
 * Now the write and the check share one transaction holding `FOR UPDATE` on
 * the attempt row, and the hand-in takes the same lock (its conditional
 * `UPDATE … WHERE submitted_at IS NULL`). Whichever gets the row first goes
 * first: a save that wins is in the paper before grading reads it; a save that
 * loses re-reads `submitted_at` after the lock is released and refuses.
 *
 * Generic over the transaction type and free of `@workspace/db` (which throws
 * at module scope without DATABASE_URL), so the refusal path is testable
 * under `node --test` with a stand-in.
 */
import { sql, type SQL } from "drizzle-orm";

export interface SqlExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface TransactionRunner<Tx> {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export type OpenWrite<T> = { open: true; value: T } | { open: false };

export async function writeWhileOpen<Tx extends SqlExecutor, T>(
  db: TransactionRunner<Tx>,
  attemptId: string,
  write: (tx: Tx) => Promise<T>,
): Promise<OpenWrite<T>> {
  return db.transaction(async tx => {
    const { rows } = await tx.execute(
      sql`select submitted_at from attempts where id = ${attemptId} for update`,
    );
    const row = rows[0];
    if (!row || row["submitted_at"] != null) return { open: false } as const;
    return { open: true, value: await write(tx) } as const;
  });
}
