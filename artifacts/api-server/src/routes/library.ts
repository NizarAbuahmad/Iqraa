/**
 * The resources library: ready-made material Iqraa staff publish per grade,
 * subject and lesson (schema: lib/db/src/schema/libraryResources.ts).
 *
 * Reading is open to any signed-in user — the library screen lives under
 * /curriculum, which students can reach too. Writing is `system_admin` only,
 * because an item reaches every teacher of its grade in every school.
 *
 * Files arrive as the raw request body (metadata in the query string), not as
 * the base64 data URLs lessonMedia.ts uses: base64 inflates by a third, and at
 * 25 MB that would cross Cloud Run's 32 MiB request ceiling. They land in the
 * public bucket and are served by a permanent URL.
 *
 * Mounted after `router.use("/library", authMiddleware)` in routes/index.ts.
 */
import express, { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, libraryResources } from "@workspace/db";
import { requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { logger } from "../lib/logger.js";
import { deletePublicObject, isPublicR2Configured, newLibraryKey, publicUrl, putPublicObject } from "../lib/r2.js";
import {
  LIBRARY_EXTENSION_BY_MIME,
  MAX_LIBRARY_FILE_BYTES,
  isLibraryCategory,
  parseLibraryLink,
  parseLibraryMeta,
} from "../lib/libraryResource.js";

const router = Router();
const adminOnly = requireRole("system_admin");

type Res = Parameters<Parameters<typeof router.get>[1]>[1];

function notSetUp(res: Res): void {
  res.status(503).json({ code: "library_unavailable", error: "The resources library is not set up on this server yet." });
}

function toClient(row: typeof libraryResources.$inferSelect) {
  return {
    id: row.id,
    gradeId: row.gradeId,
    subjectId: row.subjectId,
    lessonId: row.lessonId,
    category: row.category,
    titleAr: row.titleAr,
    description: row.description,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isLink: !row.r2Key,
    url: row.r2Key ? publicUrl(row.r2Key) : row.sourceUrl,
    semester: row.semester,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt,
  };
}

// GET /library?gradeId=grade-5 — everything published for one grade.
router.get("/library", async (req, res) => {
  const gradeId = typeof req.query["gradeId"] === "string" ? req.query["gradeId"] : "";
  if (!gradeId) {
    res.status(400).json({ error: "gradeId is required" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(libraryResources)
      .where(eq(libraryResources.gradeId, gradeId))
      .orderBy(desc(libraryResources.createdAt));
    res.json(rows.map(toClient));
  } catch (err) {
    if (isSchemaMissing(err)) {
      res.json([]); // Not set up yet reads as an empty library, not a failure.
      return;
    }
    logger.error({ err }, "library list failed");
    res.status(500).json({ error: "Failed to load the library" });
  }
});

// POST /library/link — publish a link (long video, online game).
router.post("/library/link", adminOnly, async (req: AuthenticatedRequest, res) => {
  const meta = parseLibraryMeta(req.body ?? {});
  if ("error" in meta) {
    res.status(400).json({ error: meta.error });
    return;
  }
  const sourceUrl = parseLibraryLink(req.body?.url);
  if (!sourceUrl) {
    res.status(400).json({ error: "url must be an https link" });
    return;
  }
  try {
    const [row] = await db
      .insert(libraryResources)
      .values({ ...meta, sourceUrl, createdBy: req.user!.id })
      .returning();
    res.status(201).json(toClient(row!));
  } catch (err) {
    if (isSchemaMissing(err)) return notSetUp(res);
    logger.error({ err }, "library link failed");
    res.status(500).json({ error: "Failed to save the link" });
  }
});

// POST /library/file?gradeId=…&subjectId=…&category=…&titleAr=… — body is the file itself.
router.post(
  "/library/file",
  adminOnly,
  express.raw({ type: () => true, limit: MAX_LIBRARY_FILE_BYTES }),
  async (req: AuthenticatedRequest, res) => {
    if (!isPublicR2Configured()) return notSetUp(res);
    const meta = parseLibraryMeta(req.query as Record<string, unknown>);
    if ("error" in meta) {
      res.status(400).json({ error: meta.error });
      return;
    }
    const mime = (req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const extension = LIBRARY_EXTENSION_BY_MIME[mime];
    if (!extension) {
      res.status(400).json({ error: `Unsupported file type: ${mime || "unknown"}`, code: "unsupported_type" });
      return;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "The file is empty" });
      return;
    }
    const key = newLibraryKey(extension);
    try {
      await putPublicObject(key, body, mime);
      const [row] = await db
        .insert(libraryResources)
        .values({ ...meta, r2Key: key, mimeType: mime, sizeBytes: body.length, createdBy: req.user!.id })
        .returning();
      res.status(201).json(toClient(row!));
    } catch (err) {
      // Don't leave an orphan object behind a failed insert.
      await deletePublicObject(key).catch(() => {});
      if (isSchemaMissing(err)) return notSetUp(res);
      logger.error({ err }, "library upload failed");
      res.status(500).json({ error: "Failed to upload the file" });
    }
  },
);

// DELETE /library/:id
router.delete("/library/:id", adminOnly, async (req, res) => {
  const id = req.params["id"] as string;
  // A non-uuid would reach Postgres as a cast error and come back a 500.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const [row] = await db.select().from(libraryResources).where(eq(libraryResources.id, id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (row.r2Key) await deletePublicObject(row.r2Key);
    await db.delete(libraryResources).where(eq(libraryResources.id, row.id));
    res.status(204).end();
  } catch (err) {
    if (isSchemaMissing(err)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    logger.error({ err }, "library delete failed");
    res.status(500).json({ error: "Failed to delete" });
  }
});

// PATCH /library/:id — update metadata only (title, description, category, thumbnailUrl, semester).
// The file/URL itself is immutable; to change the content, delete and re-upload.
router.patch("/library/:id", adminOnly, async (req: AuthenticatedRequest, res) => {
  const id = req.params["id"] as string;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = req.body ?? {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
  const titleAr = str(body.titleAr, 200);
  const description = str(body.description, 1000) ?? "";
  // Same reasoning as parseLibraryMeta: a slice(0,500) here would silently
  // corrupt a long signed URL into a link that saves but never loads.
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() || null : null;
  if (thumbnailUrl && thumbnailUrl.length > 2000) {
    res.status(400).json({ error: "thumbnailUrl is too long (max 2000 characters)" });
    return;
  }
  if (thumbnailUrl && !/^https:\/\//.test(thumbnailUrl)) {
    res.status(400).json({ error: "thumbnailUrl must be https" });
    return;
  }
  const semesterRaw = Number(body.semester);
  const semester = semesterRaw === 1 ? 1 : semesterRaw === 2 ? 2 : null;
  if (!titleAr) {
    res.status(400).json({ error: "titleAr is required" });
    return;
  }
  if (body.category !== undefined && !isLibraryCategory(body.category)) {
    res.status(400).json({ error: "invalid category" });
    return;
  }
  try {
    const [row] = await db
      .update(libraryResources)
      .set({
        titleAr,
        description,
        thumbnailUrl,
        semester,
        ...(body.category ? { category: body.category as string } : {}),
      })
      .where(eq(libraryResources.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(toClient(row));
  } catch (err) {
    if (isSchemaMissing(err)) return notSetUp(res);
    logger.error({ err }, "library patch failed");
    res.status(500).json({ error: "Failed to update" });
  }
});

export default router;
