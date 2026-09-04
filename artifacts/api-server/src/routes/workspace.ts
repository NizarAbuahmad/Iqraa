import { Router } from "express";
import { db } from "@workspace/db";
import { savedMaterials } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { pickDefined } from "../lib/pickDefined.js";

const router = Router();

/**
 * Single exit for every workspace failure: 503 + a code when the schema is
 * absent, so a database that never got `class_group_id` says so instead of
 * reporting a generic "Failed to save item". Mirrors `failRoster`.
 */
function failWorkspace(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  err: unknown,
  action: string,
  message: string,
): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — the saved_materials schema on this database is out of date. ` +
        "Run `pnpm --filter @workspace/db run push` against DATABASE_URL.",
    );
    res.status(503).json({
      code: "workspace_storage_unavailable",
      error: "Workspace storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: message });
}

// All workspace routes require auth, and — since a workspace item belongs to
// a teacher's own class — must be a teacher, not just any authenticated user.
router.use(authMiddleware, requireRole(...TEACHER_ROLES));

// GET /workspace/items
router.get("/items", async (req: AuthenticatedRequest, res) => {
  try {
    const { type, query, favoritesFirst, classId } = req.query as {
      type?: string;
      query?: string;
      favoritesFirst?: string;
      classId?: string;
    };

    let items = await db
      .select()
      .from(savedMaterials)
      .where(eq(savedMaterials.userId, req.user!.id))
      .orderBy(desc(savedMaterials.updatedAt));

    if (type) {
      items = items.filter((i) => i.type === type);
    }

    // Filtered here rather than in the WHERE clause to sit alongside the
    // filters above, which already load the teacher's own rows and narrow in
    // memory. A teacher has tens of materials, not thousands.
    // ponytail: move all four into the query if that ever stops being true.
    if (classId) {
      items = items.filter((i) => i.classGroupId === classId);
    }

    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subject.toLowerCase().includes(q) ||
          i.topic.toLowerCase().includes(q),
      );
    }

    if (favoritesFirst === "true") {
      items = [
        ...items.filter((i) => i.isFavorite),
        ...items.filter((i) => !i.isFavorite),
      ];
    }

    res.json(items.map(toClientItem));
  } catch (err) {
    failWorkspace(res, err, "get workspace items", "Failed to fetch workspace items");
  }
});

// GET /workspace/items/:id
router.get("/items/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = req.params["id"] as string;
    const [item] = await db
      .select()
      .from(savedMaterials)
      .where(
        and(
          eq(savedMaterials.id, itemId),
          eq(savedMaterials.userId, req.user!.id),
        ),
      )
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(toClientItem(item));
  } catch (err) {
    failWorkspace(res, err, "get workspace item", "Failed to fetch item");
  }
});

// POST /workspace/items
router.post("/items", async (req: AuthenticatedRequest, res) => {
  try {
    const {
      type,
      title,
      subject,
      grade,
      topic,
      language,
      content,
      formState,
      classGroupId,
    } = req.body as {
      type?: string;
      title?: string;
      subject?: string;
      grade?: string;
      topic?: string;
      language?: string;
      content?: unknown;
      formState?: unknown;
      classGroupId?: string | null;
    };

    if (!type || !title) {
      res.status(400).json({ error: "type and title are required" });
      return;
    }

    const [item] = await db
      .insert(savedMaterials)
      .values({
        userId: req.user!.id,
        type,
        title,
        subject: subject ?? "",
        grade: grade ?? "",
        topic: topic ?? "",
        language: language ?? "en",
        content: content ?? {},
        formState: formState ?? {},
        isFavorite: false,
        classGroupId: classGroupId ?? null,
      })
      .returning();

    res.status(201).json(toClientItem(item));
  } catch (err) {
    failWorkspace(res, err, "create workspace item", "Failed to save item");
  }
});

// PATCH /workspace/items/:id
router.patch("/items/:id", async (req: AuthenticatedRequest, res) => {
  const itemId = req.params["id"] as string;
  try {
    const updates = req.body as {
      title?: string;
      subject?: string;
      grade?: string;
      topic?: string;
      language?: string;
      content?: unknown;
      formState?: unknown;
      isFavorite?: boolean;
      classGroupId?: string | null;
    };

    // An allowlist, not a spread: `req.body` is user input, and passing it
    // whole to `.set()` would let a client write `userId` and hand its
    // materials to another teacher. `classGroupId` is nullable, and `null` is
    // the detach — see pickDefined for why that is not a truthiness check.
    const allowedFields: Record<string, unknown> = {
      ...pickDefined(updates, [
        "title",
        "subject",
        "grade",
        "topic",
        "language",
        "content",
        "formState",
        "isFavorite",
        "classGroupId",
      ]),
      updatedAt: new Date(),
    };

    const [item] = await db
      .update(savedMaterials)
      .set(allowedFields)
      .where(
        and(
          eq(savedMaterials.id, itemId),
          eq(savedMaterials.userId, req.user!.id),
        ),
      )
      .returning();

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(toClientItem(item));
  } catch (err) {
    failWorkspace(res, err, "update workspace item", "Failed to update item");
  }
});

// DELETE /workspace/items/:id
router.delete("/items/:id", async (req: AuthenticatedRequest, res) => {
  const itemId = req.params["id"] as string;
  try {
    const [deleted] = await db
      .delete(savedMaterials)
      .where(
        and(
          eq(savedMaterials.id, itemId),
          eq(savedMaterials.userId, req.user!.id),
        ),
      )
      .returning({ id: savedMaterials.id });

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    failWorkspace(res, err, "delete workspace item", "Failed to delete item");
  }
});

// POST /workspace/items/:id/duplicate
router.post("/items/:id/duplicate", async (req: AuthenticatedRequest, res) => {
  const itemId = req.params["id"] as string;
  try {
    const [original] = await db
      .select()
      .from(savedMaterials)
      .where(
        and(
          eq(savedMaterials.id, itemId),
          eq(savedMaterials.userId, req.user!.id),
        ),
      )
      .limit(1);

    if (!original) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const [copy] = await db
      .insert(savedMaterials)
      .values({
        userId: req.user!.id,
        type: original.type,
        title: `${original.title} (copy)`,
        subject: original.subject,
        grade: original.grade,
        topic: original.topic,
        language: original.language,
        content: original.content,
        formState: original.formState,
        isFavorite: false,
        // The copy starts unattached on purpose: duplicating is how one
        // worksheet reaches a second section, so inheriting the first
        // section's class would put both copies in the same place.
        classGroupId: null,
      })
      .returning();

    res.status(201).json(toClientItem(copy));
  } catch (err) {
    failWorkspace(res, err, "duplicate workspace item", "Failed to duplicate item");
  }
});

function toClientItem(item: typeof savedMaterials.$inferSelect) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    subject: item.subject,
    grade: item.grade,
    topic: item.topic,
    language: item.language,
    content: typeof item.content === "string" ? item.content : JSON.stringify(item.content),
    formState: typeof item.formState === "object" ? item.formState : {},
    isFavorite: item.isFavorite,
    classGroupId: item.classGroupId,
    savedAt: item.updatedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  };
}

export default router;
