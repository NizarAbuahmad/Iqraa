/**
 * Cloudflare R2 (S3-compatible) client for source PDFs too big or unreliable
 * to keep committed or fetched through Drive.
 *
 * Why this exists: fetching large NCCD PDFs through the Drive MCP tools has
 * two hard failure modes — a 10MB single-call ceiling on the small-file path,
 * and two distinct corruption bugs on the large-file fallback (whole-line
 * character reversal on some documents; blank OCR-less pages on scanned
 * ones). Neither is fixable by reorganizing Drive folders — they're limits of
 * the fetch tool itself. R2 replaces that fetch path with a plain S3 GET,
 * which this sandbox can actually reach (unlike `nccd.gov.jo` or Drive's own
 * UI), and Cloudflare charges zero egress, so repeated extraction runs don't
 * cost anything beyond the flat storage price.
 *
 * Configured entirely through env vars (see LOCAL_SETUP.md); unset means R2
 * is simply not used — `downloadFromR2` returns `null` rather than throwing,
 * so a checkout without R2 configured behaves exactly as it did before this
 * file existed.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let cachedClient: S3Client | null | undefined;

function r2Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/** The bucket every helper here reads/writes, from `R2_BUCKET` (default `iqraa-media`). */
function bucket(): string {
  return process.env.R2_BUCKET || 'iqraa-media';
}

/**
 * Fetch one object's bytes from R2. Returns `null` — not an error — when R2
 * isn't configured, the object doesn't exist (`NoSuchKey`), or the fetch
 * fails, so a caller's existing "not available" path (e.g. `extract-text.ts`
 * skipping a missing source) keeps working unchanged.
 */
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  const client = r2Client();
  if (!client) return null;

  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    const code = (err as { name?: string })?.name;
    if (code === 'NoSuchKey') return null;
    console.error(`R2 fetch failed for ${key}:`, err);
    return null;
  }
}

/**
 * Push one object's bytes to R2. Used by `upload-to-r2.ts` to back up a
 * locally-held source so future extraction runs — in this sandbox or
 * anyone else's — no longer need the original Drive link at all.
 */
export async function uploadToR2(key: string, body: Buffer, contentType = 'application/pdf'): Promise<boolean> {
  const client = r2Client();
  if (!client) return false;

  await client.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return true;
}

/** True when all three R2 env vars are set — the same check `r2Client()` makes, exposed for callers that want to log/skip up front. */
export function isR2Configured(): boolean {
  return r2Client() !== null;
}
