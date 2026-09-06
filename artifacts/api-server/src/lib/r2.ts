/**
 * Cloudflare R2 (S3-compatible) client for teacher-uploaded lesson media.
 *
 * Separate from `lib/curriculum/scripts/r2.ts`, which is a dev/CI tool that
 * uses `node:fs` and runs as a one-off script — this one runs inside the
 * live API process, on every upload/download request. Same bucket, same env
 * vars, different lifetime and different concerns (streaming a response body
 * rather than writing to disk).
 *
 * Gated by the same three env vars; unconfigured means every route here
 * answers 503, the same "not set up on this server yet" shape `workspace.ts`
 * already uses for a missing DB schema — not a 500, since this is a known,
 * expected state (R2 is optional), not a bug.
 */
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

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
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

function bucket(): string {
  return process.env.R2_BUCKET || "iqraa-media";
}

export function isR2Configured(): boolean {
  return r2Client() !== null;
}

/**
 * A random key under `lesson-media/` — never the caller's filename. Two
 * reasons: it keeps this feature's objects out of the flat `<sourceId>.pdf`
 * namespace `extract-text.ts` owns, and a UUID key is not guessable even if
 * the bucket's "Public Development URL" toggle is ever left on (see
 * STATUS.md's 2026-08-30 entry) — defense in depth, not a substitute for
 * keeping that toggle off for anything meant to stay private.
 */
export function newLessonMediaKey(extension: string): string {
  return `lesson-media/${randomUUID()}${extension}`;
}

/** Same reasoning as newLessonMediaKey, its own prefix so chat attachments never collide with lesson media in the bucket. */
export function newChatMediaKey(extension: string): string {
  return `chat-media/${randomUUID()}${extension}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = r2Client();
  if (!client) throw new Error("R2 is not configured");
  await client.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

/**
 * A time-limited, signed GET URL for one object — not a proxy stream.
 * Deliberate: the client (Expo web included) needs a plain URL it can hand
 * an `<Image>`/`<audio>` tag directly, and a web `<img>` cannot attach an
 * `Authorization` header the way a native `Image` component can. A signed
 * URL gives the same effective privacy (unguessable, expires) without that
 * platform gap. `expiresInSeconds` default (1 hour) comfortably covers one
 * viewing session; a stale link just means the client re-fetches the list.
 */
export async function presignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string | null> {
  const client = r2Client();
  if (!client) return null;
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const client = r2Client();
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
