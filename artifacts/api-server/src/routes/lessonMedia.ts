/**
 * A teacher's media library — the things they drop into a lesson deck or send
 * to a student.
 *
 * Two kinds of item live here (see `lib/db/src/schema/lessonMedia.ts`):
 * an UPLOAD, whose bytes are in R2, and a REFERENCE to something already on
 * the web. Both are listed through the same shape, with one `url` field, so a
 * caller never branches on which it got.
 *
 * An upload's `url` is a time-limited signed GET URL (see `lib/r2.ts`'s
 * `presignedGetUrl`), never a public R2 URL and never a proxy stream: these
 * are a teacher's own files, not published curriculum material, and a web
 * `<img>` cannot attach an `Authorization` header the way a native `Image`
 * component can — a proxy endpoint would work on native and silently fail to
 * render on Expo web. Because the signature expires, anything that *stores* a
 * deck has to re-resolve it on load rather than keep the string
 * (`refreshDeckMedia` in the app's `services/classMedia.ts`).
 *
 * Files travel as `data:` URLs in the JSON body, the same shape
 * `attempts.ts`'s `scan-marks` already uses — there is no multipart upload
 * path anywhere in this server, and adding one is a bigger change than this
 * feature needs. Same 8MB string-length cap for the same reason: roughly a
 * high-quality phone photo once base64 has inflated it by a third. Video is
 * therefore reference-only; a video file fits neither the cap nor the budget.
 *
 * Mounted under `/media`, already `authMiddleware`-guarded at the mount site
 * in `routes/index.ts`. No `router.use(authMiddleware)` here — a bare
 * `router.use` inside a router becomes API-wide middleware, the trap
 * `mountOrder.test.ts` exists to catch.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessages, lessonMedia } from "@workspace/db";
import { and, desc, eq, ilike } from "drizzle-orm";
import { type AuthenticatedRequest } from "../middlewares/auth.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { logger } from "../lib/logger.js";
import { deleteObject, isR2Configured, newLessonMediaKey, presignedGetUrl, putObject } from "../lib/r2.js";
import { EXTENSION_BY_MIME, MAX_DATA_URL_LENGTH, kindForMime, parseDataUrl } from "../lib/lessonMediaUpload.js";
import { isMediaKind, isValidLibraryLink } from "../lib/mediaLibrary.js";

const router = Router();

/**
 * A library listing is a browse surface, so it takes a ceiling rather than a
 * cursor.
 *
 * ponytail: 200 newest items, no pagination. A teacher who has saved more than
 * 200 things has a filing problem a page 2 would not solve — add folders or
 * tags before adding a cursor.
 */
const LIBRARY_LIMIT = 200;

function fail503(res: Parameters<Parameters<typeof router.get>[1]>[1]): void {
  res.status(503).json({
    code: "lesson_media_unavailable",
    error: "Lesson attachments are not set up on this server yet.",
  });
}

/**
 * POST /media/lesson — add an item to the library.
 *
 * Either `dataUrl` (an upload) or `sourceUrl` + `kind` (a reference).
 * `lessonId` is optional: with it the item also shows in that lesson's
 * attachments, without it the item is library-only.
 *
 * A reference is checked for being an https URL and a known kind, and no
 * further. The app classifies the URL with `classifyMediaUrl()` before it ever
 * gets here; re-deriving the kind server-side would put the same rule in two
 * files that must then move together — the failure mode CLAUDE.md names for
 * activity formats and difficulty tiers. The blast radius of a wrong kind is
 * one row in the library of the teacher who saved it.
 */
router.post("/lesson", async (req: AuthenticatedRequest, res) => {
  try {
    const lessonId = typeof req.body?.lessonId === "string" ? req.body.lessonId.trim() : "";
    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    const sourceUrl = typeof req.body?.sourceUrl === "string" ? req.body.sourceUrl.trim() : "";
    const caption = typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 300) : "";

    if (!dataUrl && !sourceUrl) {
      res.status(400).json({ error: "dataUrl or sourceUrl is required", code: "bad_media_source" });
      return;
    }

    // ── A reference: nothing to store, so R2 need not be configured ─────────
    if (!dataUrl) {
      const kind: unknown = req.body?.kind;
      if (!isMediaKind(kind)) {
        res.status(400).json({ error: `Unsupported kind: ${String(kind)}`, code: "unsupported_kind" });
        return;
      }
      if (!isValidLibraryLink(sourceUrl)) {
        res.status(400).json({ error: "sourceUrl must be an https URL", code: "bad_source_url" });
        return;
      }
      const [linked] = await db
        .insert(lessonMedia)
        .values({ userId: req.user!.id, lessonId: lessonId || null, kind, sourceUrl, caption })
        .returning();
      res.status(201).json(await toClientItem(linked!));
      return;
    }

    // ── An upload ───────────────────────────────────────────────────────────
    if (!isR2Configured()) {
      fail503(res);
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
        lessonId: lessonId || null,
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

// GET /media/lesson?lessonId=... — a teacher's own attachments for one lesson.
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

/**
 * GET /media/library?q=&kind= — everything this teacher has, newest first.
 *
 * The cross-lesson view `GET /lesson` deliberately is not: an item saved while
 * planning one lesson is exactly what a teacher reaches for while planning the
 * next, which is the whole reason the library exists.
 */
router.get("/library", async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
    const kind = typeof req.query["kind"] === "string" ? req.query["kind"] : "";

    const filters = [eq(lessonMedia.userId, req.user!.id)];
    if (q) filters.push(ilike(lessonMedia.caption, `%${q}%`));
    if (isMediaKind(kind)) filters.push(eq(lessonMedia.kind, kind));

    const rows = await db
      .select()
      .from(lessonMedia)
      .where(and(...filters))
      .orderBy(desc(lessonMedia.createdAt))
      .limit(LIBRARY_LIMIT);
    res.json(await Promise.all(rows.map(toClientItem)));
  } catch (err) {
    if (isSchemaMissing(err)) {
      res.json([]); // An empty library, not a failure.
      return;
    }
    logger.error({ err }, "media-library list failed");
    res.status(500).json({ error: "Failed to list media" });
  }
});

/**
 * DELETE /media/lesson/:id
 *
 * The row always goes. The R2 object only goes if nothing else points at it:
 * sharing a library item to a student reuses its key on the chat message
 * rather than copying the bytes (see `routes/messaging.ts`), so deleting here
 * without checking would blank a photo already sitting in a student's thread —
 * content vanishing out of a conversation someone else can see, days later,
 * with nothing to explain it.
 *
 * Orphaning an object is the cheaper mistake: it costs storage, and the row
 * that named it is gone either way.
 */
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
    if (row.r2Key && !(await keyIsShared(row.r2Key))) await deleteObject(row.r2Key);
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

/** Whether any chat message still renders this object. */
async function keyIsShared(r2Key: string): Promise<boolean> {
  const [used] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(eq(chatMessages.attachmentKey, r2Key))
    .limit(1);
  return Boolean(used);
}

/**
 * One client shape for both kinds of row. `url` is a fresh signed URL for an
 * upload and the plain source for a reference, so the app renders either
 * without asking which it is holding.
 */
async function toClientItem(row: typeof lessonMedia.$inferSelect) {
  return {
    id: row.id,
    lessonId: row.lessonId,
    kind: row.kind,
    caption: row.caption,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    /** True for a reference — this url does not expire and needs no refresh. */
    isLink: !row.r2Key,
    // null when R2 rejects the presign request (e.g. mid-outage) — the
    // client treats a missing url as "can't preview right now", not a crash.
    url: row.r2Key ? await presignedGetUrl(row.r2Key) : row.sourceUrl,
  };
}

export default router;
