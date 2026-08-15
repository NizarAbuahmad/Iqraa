import { Router } from "express";
import { db } from "@workspace/db";
import { savedMaterials } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// All workspace routes require auth
router.use(authMiddleware);

// GET /workspace/items
router.get("/items", async (req: AuthenticatedRequest, res) => {
  try {
    const { type, query, favoritesFirst } = req.query as {
      type?: string;
      query?: string;
      favoritesFirst?: string;
    };

    let items = await db
      .select()
      .from(savedMaterials)
      .where(eq(savedMaterials.userId, req.user!.id))
      .orderBy(desc(savedMaterials.updatedAt));

    if (type) {
      items = items.filter((i) => i.type === type);
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
    logger.error({ err }, "get workspace items failed");
    res.status(500).json({ error: "Failed to fetch workspace items" });
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
    logger.error({ err }, "get workspace item failed");
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// POST /workspace/items
router.post("/items", async (req: AuthenticatedRequest, res) => {
  try {
    const { type, title, subject, grade, topic, language, content, formState } =
      req.body as {
        type?: string;
        title?: string;
        subject?: string;
        grade?: string;
        topic?: string;
        language?: string;
        content?: unknown;
        formState?: unknown;
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
      })
      .returning();

    res.status(201).json(toClientItem(item));
  } catch (err) {
    logger.error({ err }, "create workspace item failed");
    res.status(500).json({ error: "Failed to save item" });
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
    };

    const allowedFields: Record<string, unknown> = {};
    if (updates.title !== undefined) allowedFields.title = updates.title;
    if (updates.subject !== undefined) allowedFields.subject = updates.subject;
    if (updates.grade !== undefined) allowedFields.grade = updates.grade;
    if (updates.topic !== undefined) allowedFields.topic = updates.topic;
    if (updates.language !== undefined) allowedFields.language = updates.language;
    if (updates.content !== undefined) allowedFields.content = updates.content;
    if (updates.formState !== undefined) allowedFields.formState = updates.formState;
    if (updates.isFavorite !== undefined) allowedFields.isFavorite = updates.isFavorite;
    allowedFields.updatedAt = new Date();

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
    logger.error({ err }, "update workspace item failed");
    res.status(500).json({ error: "Failed to update item" });
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
    logger.error({ err }, "delete workspace item failed");
    res.status(500).json({ error: "Failed to delete item" });
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
      })
      .returning();

    res.status(201).json(toClientItem(copy));
  } catch (err) {
    logger.error({ err }, "duplicate workspace item failed");
    res.status(500).json({ error: "Failed to duplicate item" });
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
    savedAt: item.updatedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  };
}

export default router;
