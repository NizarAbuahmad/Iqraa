/**
 * Teacher-uploaded media (image/audio/document) attached to a curriculum
 * lesson, stored in R2 — never a public R2 URL, since these are a teacher's
 * own files, not published curriculum material. Every item's `url` is a
 * time-limited signed GET URL (see `lib/r2.ts`'s `presignedGetUrl`), not a
 * proxy stream: a web `<img>` can't attach an `Authorization` header the way
 * a native `Image` component can, so a proxy endpoint here would work on
 * native and silently fail to render on Expo web. Mounted under `/media`,
 * already `authMiddleware`-guarded at the mount site in `routes/index.ts`.
 *
 * Files travel as `data:` URLs in the JSON body, the same shape
 * `attempts.ts`'s `scan-marks` already uses — there is no multipart upload
 * path anywhere in this server, and adding one is a bigger change than this
 * feature needs. Same 8MB string-length cap for the same reason: roughly a
 * high-quality phone photo once base64 has inflated it by a third.
 *
 * No `router.use(authMiddleware)` here — `routes/index.ts` already guards
 * the whole `/media` prefix at the mount site, the same convention `media.ts`
 * (mounted right next to this router) already relies on.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { lessonMedia } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { type AuthenticatedRequest } from "../middlewares/auth.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { logger } from "../lib/logger.js";
import { deleteObject, isR2Configured, newLessonMediaKey, presignedGetUrl, putObject } from "../lib/r2.js";
import { EXTENSION_BY_MIME, MAX_DATA_URL_LENGTH, kindForMime, parseDataUrl } from "../lib/lessonMediaUpload.js";

const router = Router();

function fail503(res: Parameters<Parameters<typeof router.get>[1]>[1]): void {
  res.status(503).json({
    code: "lesson_media_unavailable",
    error: "Lesson attachments are not set up on this server yet.",
  });
}

// POST /media/lesson — attach a file to a lesson.
router.post("/lesson", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isR2Configured()) {
      fail503(res);
      return;
    }

    const lessonId = typeof req.body?.lessonId === "string" ? req.body.lessonId.trim() : "";
    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    const caption = typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 300) : "";

    if (!lessonId) {
      res.status(400).json({ error: "lessonId is required", code: "bad_lesson_id" });
      return;
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      res.status(413).json({
        error: "That file is too large. Try a smaller image or a shorter recording.",
        code: "file_too_large",
      });
      return;
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      res.status(400).json({ error: "dataUrl must be a data: URL", code: "bad_data_url" });
      return;
    }
    const extension = EXTENSION_BY_MIME[parsed.mime];
    if (!extension) {
      res.status(400).json({ error: `Unsupported file type: ${parsed.mime}`, code: "unsupported_type" });
      return;
    }

    const key = newLessonMediaKey(extension);
    await putObject(key, parsed.buffer, parsed.mime);

    const [row] = await db
      .insert(lessonMedia)
      .values({
        userId: req.user!.id,
        lessonId,
        kind: kindForMime(parsed.mime),
        r2Key: key,
        caption,
        mimeType: parsed.mime,
        sizeBytes: parsed.buffer.length,
      })
      .returning();

    res.status(201).json(await toClientItem(row!));
  } catch (err) {
    if (isSchemaMissing(err)) {
      fail503(res);
      return;
    }
    logger.error({ err }, "lesson-media upload failed");
    res.status(500).json({ error: "Failed to attach file" });
  }
});

// GET /media/lesson?lessonId=... — list a teacher's own attachments for a lesson.
router.get("/lesson", async (req: AuthenticatedRequest, res) => {
  try {
    const lessonId = typeof req.query["lessonId"] === "string" ? req.query["lessonId"] : "";
    if (!lessonId) {
      res.status(400).json({ error: "lessonId is required", code: "bad_lesson_id" });
      return;
    }
    const rows = await db
      .select()
      .from(lessonMedia)
      .where(and(eq(lessonMedia.userId, req.user!.id), eq(lessonMedia.lessonId, lessonId)));
    res.json(await Promise.all(rows.map(toClientItem)));
  } catch (err) {
    if (isSchemaMissing(err)) {
      res.json([]); // Unset up is "no attachments yet", not a listing failure.
      return;
    }
    logger.error({ err }, "lesson-media list failed");
    res.status(500).json({ error: "Failed to list attachments" });
  }
});

// DELETE /media/lesson/:id
router.delete("/lesson/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const [row] = await db
      .select()
      .from(lessonMedia)
      .where(and(eq(lessonMedia.id, req.params["id"] as string), eq(lessonMedia.userId, req.user!.id)));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await deleteObject(row.r2Key);
    await db.delete(lessonMedia).where(eq(lessonMedia.id, row.id));
    res.status(204).end();
  } catch (err) {
    if (isSchemaMissing(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    logger.error({ err }, "lesson-media delete failed");
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

async function toClientItem(row: typeof lessonMedia.$inferSelect) {
  return {
    id: row.id,
    lessonId: row.lessonId,
    kind: row.kind,
    caption: row.caption,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    // null when R2 rejects the presign request (e.g. mid-outage) — the
    // client treats a missing url as "can't preview right now", not a crash.
    url: await presignedGetUrl(row.r2Key),
  };
}

export default router;
