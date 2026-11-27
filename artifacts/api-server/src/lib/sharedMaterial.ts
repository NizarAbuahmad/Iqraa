/**
 * A teacher's saved material (ملفاتي) opened from its share link, `/m/CODE`
 * (spec docs/superpowers/specs/2026-11-20-material-share-link-design.md).
 *
 * `saved_materials` is the owner's private workspace — routes/workspace.ts
 * serves a row only to its owner — and the share code is the one other key to
 * a row. It is another teacher's row (or no user at all), so the read is
 * `systemDb`, as in lib/homeworkMaterial.ts: once `saved_materials` gets an
 * owner-only policy, the caller's identity would read nothing (CLAUDE.md).
 *
 * What leaves here is the paper only: never `formState` (a lesson plan's
 * `adaptations` can name a pupil), never the owner, and the content with every
 * word-for-word quote of the owner's notes removed (`redactOwnerNotes`). The public read is the
 * student copy (`studentCopy`); `full` keeps the answers, and the route serves
 * it to a teacher only. No generation code here.
 */
import { db, savedMaterials, systemDb, type SavedMaterial } from "@workspace/db";
import { eq } from "drizzle-orm";

import { studentCopy } from "../modules/homework/materialCopy.ts";
import { copyableFormState, normalizeMaterialShareCode, redactOwnerNotes, sharedPublicContent } from "./materialShare.ts";

export interface SharedMaterial {
  type: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: string;
  /** JSON text, as GET /workspace/items/:id sends it. */
  content: string;
  savedAt: string;
}

async function rowByCode(rawCode: unknown): Promise<SavedMaterial | null> {
  const code = normalizeMaterialShareCode(rawCode);
  if (!code) return null;
  const [row] = await systemDb.select().from(savedMaterials).where(eq(savedMaterials.shareCode, code)).limit(1);
  return row ?? null;
}

export async function loadSharedMaterial(rawCode: unknown, { full }: { full: boolean }): Promise<SharedMaterial | null> {
  const m = await rowByCode(rawCode);
  if (!m) return null;
  // The owner's notes come out first, for teacher and visitor alike: generation
  // quotes them into the content (a lesson plan's `priorReview`), and they can
  // name a pupil.
  const content = redactOwnerNotes(parsed(m.content), m.formState);
  return {
    type: m.type,
    title: m.title,
    subject: m.subject,
    grade: m.grade,
    topic: m.topic,
    language: m.language,
    content: JSON.stringify(full ? content : sharedPublicContent(m.type, content, studentCopy)),
    savedAt: m.updatedAt.toISOString(),
  };
}

/**
 * The shared material as a new row in `userId`'s own files: the answers kept
 * (the route lets only a teacher do this), the owner's free-text notes dropped,
 * and none of the owner's state — not favourite, no class, not shared.
 * The insert is the caller's own row, so it goes through `db`.
 */
export async function copySharedMaterial(rawCode: unknown, userId: string): Promise<SavedMaterial | null> {
  const m = await rowByCode(rawCode);
  if (!m) return null;
  const [copy] = await db
    .insert(savedMaterials)
    .values({
      userId,
      type: m.type,
      title: m.title,
      subject: m.subject,
      grade: m.grade,
      topic: m.topic,
      language: m.language,
      content: redactOwnerNotes(parsed(m.content), m.formState) as typeof m.content,
      formState: copyableFormState(m.formState),
      isFavorite: false,
      classGroupId: null,
    })
    .returning();
  return copy ?? null;
}

/** Some rows hold their content as JSON text inside the jsonb column; unreadable text is no content. */
function parsed(content: unknown): unknown {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
