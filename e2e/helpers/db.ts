import { createHash } from "node:crypto";
import pg from "pg";

async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Limits live in Postgres and outlast a run: 3 registrations an hour per IP would fail the second run. */
export const resetRateLimits = () => withDb((c) => c.query("truncate rate_limit_buckets").then(() => undefined));

/**
 * The verification code is emailed in production and only logged otherwise, so
 * a test cannot read it. Plant a token whose code we know instead — the newest
 * unused, unexpired token wins — and type that into the real verify screen.
 */
export async function plantVerificationCode(email: string, code: string): Promise<void> {
  await withDb(async (c) => {
    const { rows } = await c.query("select id from users where lower(email) = lower($1)", [email]);
    if (!rows[0]) throw new Error(`plantVerificationCode: no user ${email} — did the sign-up request fail?`);
    await c.query(
      "insert into email_verification_tokens (user_id, code_hash, expires_at) values ($1, $2, now() + interval '15 minutes')",
      [rows[0].id, createHash("sha256").update(code).digest("hex")],
    );
  });
}

/**
 * A material in a teacher's own files (ملفاتي), as the app's save would leave it.
 * Generating one through the UI is its own journey (and a slow one); the share
 * link only needs a saved row to share.
 */
export async function insertSavedMaterial(
  email: string,
  m: { type: string; title: string; content: unknown; formState?: unknown },
): Promise<string> {
  return withDb(async (c) => {
    const { rows } = await c.query(
      `insert into saved_materials (user_id, type, title, subject, grade, topic, language, content, form_state)
       select id, $2, $3, 'Mathematics', 'الصف العاشر', $3, 'en', $4::jsonb, $5::jsonb from users where lower(email) = lower($1)
       returning id`,
      [email, m.type, m.title, JSON.stringify(m.content), JSON.stringify(m.formState ?? {})],
    );
    if (!rows[0]) throw new Error(`insertSavedMaterial: no user ${email}`);
    return rows[0].id as string;
  });
}

/** The material's share-link code, or null while it is not shared. */
export const shareCodeOf = (id: string) =>
  withDb(async (c) => (await c.query("select share_code from saved_materials where id = $1", [id])).rows[0]?.share_code as string | null);
