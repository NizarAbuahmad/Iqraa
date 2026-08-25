/**
 * Knowledge bank read API.
 *
 * The bank has lived in `@workspace/curriculum` since the two source catalogs
 * were merged, but only the mobile app read it. The assessment module runs
 * here, and it is the part that most needs to know what real material exists:
 * `mockGenerator` refuses to fabricate four of the eight question types, and
 * the documents that would supply them honestly — question banks, past papers,
 * answer keys — were invisible to it.
 *
 * Read-only and unauthenticated, on the same reasoning as `curriculum.ts`: this
 * is a catalog of document titles and provenance, the same content the app
 * already ships to every device. It does not serve the documents themselves —
 * there is nothing here to serve, the binaries are not in the repo.
 *
 * **`usePolicy` travels with every item.** A caller assembling something a
 * teacher will export needs to know that nine of the ten past papers are a
 * named teacher's own work. Sending the catalog without the policy would make
 * the omission the caller's problem, which is how these things get forgotten.
 */
import { Router } from "express";
import {
  bankItems,
  bankStats,
  bankTagsForUnit,
  getObjectiveById,
  itemsForUnit,
  usePolicy,
  type BankFilter,
  type CurriculumSource,
  type SourceKind,
} from "@workspace/curriculum";

const bankRouter = Router();

/** What a caller gets. Drops `driveId` — an id for a file we do not serve. */
function publicItem(s: CurriculumSource) {
  return {
    id: s.id,
    title: s.title,
    kind: s.kind,
    subject: s.subject,
    semester: s.semester,
    authority: s.authority,
    authorAr: s.authorAr,
    /** Resolved here so no caller has to re-derive it from `authority`. */
    usePolicy: usePolicy(s),
    unitTags: s.unitTags,
    /** Empty on every item today — nothing is mined to objective granularity. */
    objectiveIds: s.objectiveIds,
    /**
     * 'pending' means the document is on file and nothing has been extracted
     * from it. Most of the bank is pending; a caller that treats this catalog
     * as content rather than as an index will be wrong about 63 of 78 entries.
     */
    status: s.status,
  };
}

const KINDS: readonly SourceKind[] = [
  "student-book", "teacher-guide", "activity-book", "ministry-support",
  "worksheet", "answer-key", "summary", "study-pack", "question-bank", "exam",
];

/** Parse `?kind=exam,question-bank` into validated kinds, or undefined. */
function parseKinds(raw: unknown): SourceKind[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const asked = raw.split(",").map(k => k.trim()).filter(Boolean);
  const valid = asked.filter((k): k is SourceKind => (KINDS as readonly string[]).includes(k));
  // An unknown kind is a caller error, not an empty filter: silently returning
  // the whole bank for `?kind=quiz` — the old vocabulary's word for it — would
  // look like a working query.
  return valid.length === asked.length ? valid : [];
}

bankRouter.get("/bank/items", (req, res) => {
  const kinds = parseKinds(req.query.kind);
  if (kinds?.length === 0) {
    res.status(400).json({ error: "unknown_kind", allowed: KINDS });
    return;
  }

  const unitId = typeof req.query.unitId === "string" ? req.query.unitId : undefined;
  const filter: BankFilter = {};
  if (typeof req.query.subjectId === "string") filter.subjectId = req.query.subjectId;
  if (kinds) filter.kind = kinds;

  const items = unitId ? itemsForUnit(unitId, filter) : bankItems(filter);
  res.json({
    items: items.map(publicItem),
    // Echoed so a caller can tell "this unit has no material" from "this unit
    // id resolved to no tags" — a silently empty list conflates them.
    unitTags: unitId ? bankTagsForUnit(unitId) : null,
    total: items.length,
  });
});

/**
 * What the bank holds for a set of objectives.
 *
 * The shape the generator needs: objectives come in, the material scoped to
 * their units comes back. Objective ids that do not resolve are named rather
 * than dropped.
 */
bankRouter.get("/bank/for-objectives", (req, res) => {
  const raw = typeof req.query.objectiveIds === "string" ? req.query.objectiveIds : "";
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (!ids.length) {
    res.status(400).json({ error: "objectiveIds_required" });
    return;
  }

  const unknown: string[] = [];
  const unitIds = new Set<string>();
  for (const id of ids) {
    const objective = getObjectiveById(id);
    if (!objective) unknown.push(id);
    else unitIds.add(objective.unitId);
  }

  const byId = new Map<string, CurriculumSource>();
  for (const unitId of unitIds) {
    // A document scoped to two of the requested units must be listed once.
    for (const item of itemsForUnit(unitId)) byId.set(item.id, item);
  }

  res.json({
    items: [...byId.values()].map(publicItem),
    unitIds: [...unitIds],
    unknownObjectiveIds: unknown,
    total: byId.size,
  });
});

bankRouter.get("/bank/stats", (_req, res) => {
  res.json(bankStats());
});

export default bankRouter;
