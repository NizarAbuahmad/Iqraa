/**
 * A teacher's saved material (ملفاتي) as the class's families see it, opened
 * from a homework it is attached to.
 *
 * `saved_materials` is the teacher's private workspace — routes/workspace.ts
 * serves a row only to its owner — so this is the one door into it for anyone
 * else, and every condition must hold or the answer is null (a 404, whatever
 * the reason):
 *  - the homework is live and its class is live;
 *  - one of the caller's roster rows (`studentIds`: a student's `self` rows or
 *    a parent's `guardian` rows, from lib/familyAccess.ts) is in that class;
 *  - the material is listed in the homework's `resources`;
 *  - the material still belongs to the homework's teacher.
 *
 * The access checks run on `db`, as the caller, over rows they are entitled to.
 * Only the material read is `systemDb`: it is the teacher's row, which the
 * caller's identity will not see once `saved_materials` gets an owner-only
 * policy — and RLS would then return nothing rather than fail (CLAUDE.md).
 * The content goes out as `studentCopy` — no answers. No generation code here.
 */
import { classGroups, classMemberships, db, homework, savedMaterials, systemDb } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isUuid } from "../modules/homework/rules.ts";
import { studentCopy } from "../modules/homework/materialCopy.ts";

export interface FamilyMaterial {
  id: string;
  type: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: string;
  /** JSON text, as GET /workspace/items/:id sends it — with the answers taken out. */
  content: string;
  savedAt: string;
}

export async function loadHomeworkMaterial(
  studentIds: string[],
  homeworkId: string,
  materialId: string,
): Promise<FamilyMaterial | null> {
  if (studentIds.length === 0 || !isUuid(homeworkId) || !isUuid(materialId)) return null;

  const [hw] = await db
    .select({ classGroupId: homework.classGroupId, teacherId: homework.teacherId, resources: homework.resources })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(eq(homework.id, homeworkId), isNull(homework.archivedAt), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!hw) return null;

  const id = materialId.toLowerCase();
  if (!hw.resources.some(r => r.kind === "material" && r.materialId === id)) return null;

  const [member] = await db
    .select({ studentId: classMemberships.studentId })
    .from(classMemberships)
    .where(and(eq(classMemberships.classGroupId, hw.classGroupId), inArray(classMemberships.studentId, studentIds)))
    .limit(1);
  if (!member) return null;

  const [m] = await systemDb
    .select()
    .from(savedMaterials)
    .where(and(eq(savedMaterials.id, id), eq(savedMaterials.userId, hw.teacherId)))
    .limit(1);
  if (!m) return null;

  return {
    id: m.id,
    type: m.type,
    title: m.title,
    subject: m.subject,
    grade: m.grade,
    topic: m.topic,
    language: m.language,
    content: JSON.stringify(studentCopy(parsed(m.content))),
    savedAt: m.updatedAt.toISOString(),
  };
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
