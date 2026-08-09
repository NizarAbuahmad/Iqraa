/**
 * Curriculum read API.
 *
 * Exists so the server can resolve grades, subjects, books, units, lessons and
 * learning objectives on its own. The evaluation module generates and grades
 * questions against objectives; if the server took the client's word for what
 * the curriculum says, "stay within the selected grade and curriculum content"
 * would be a request rather than a constraint.
 *
 * Read-only and unauthenticated: this is published national curriculum data,
 * the same content the app already ships to every device.
 */
import { Router } from "express";
import {
  bloomsCoverage,
  getBookById,
  getBooksForSubjectGrade,
  getLessonById,
  getLessonsForUnit,
  getObjectivesForBook,
  getObjectivesForLesson,
  getObjectivesForUnit,
  getSubjectsForGrade,
  getUnitById,
  getUnitsForBook,
  getVisibleGrades,
  resolveObjectiveIds,
  type CurriculumObjective,
} from "@workspace/curriculum";

const curriculumRouter = Router();

/** Trim the objective down to what a caller needs; drop internal lesson echoes. */
function publicObjective(o: CurriculumObjective) {
  return {
    id: o.id,
    lessonId: o.lessonId,
    description: o.description,
    descriptionAr: o.descriptionAr,
    bloomsLevel: o.bloomsLevel,
    // Callers must branch on this before trusting bloomsLevel — every
    // NCCD-derived objective is stamped 'Understand' by the catalog builder
    // rather than classified. See lib/curriculum/src/objectives.ts.
    bloomsSource: o.bloomsSource,
    // Inferred from the objective's own wording where the stored level was a
    // default. `effectiveBloomsLevel` is what callers should read.
    inferredBloomsLevel: o.inferredBloomsLevel,
    effectiveBloomsLevel: o.effectiveBloomsLevel,
    skills: o.skills,
    lessonTitleAr: o.lessonTitleAr,
    unitId: o.unitId,
    unitNameAr: o.unitNameAr,
    bookId: o.bookId,
    subjectId: o.subjectId,
    gradeId: o.gradeId,
  };
}

curriculumRouter.get("/curriculum/grades", (_req, res) => {
  res.json({ grades: getVisibleGrades() });
});

curriculumRouter.get("/curriculum/subjects", (req, res) => {
  const gradeId = String(req.query.gradeId ?? "");
  if (!gradeId) {
    res.status(400).json({ error: "gradeId is required" });
    return;
  }
  res.json({ subjects: getSubjectsForGrade(gradeId) });
});

curriculumRouter.get("/curriculum/books", (req, res) => {
  const gradeId = String(req.query.gradeId ?? "");
  const subjectId = String(req.query.subjectId ?? "");
  if (!gradeId || !subjectId) {
    res.status(400).json({ error: "gradeId and subjectId are required" });
    return;
  }
  res.json({ books: getBooksForSubjectGrade(subjectId, gradeId, "teacher") });
});

curriculumRouter.get("/curriculum/units", (req, res) => {
  const bookId = String(req.query.bookId ?? "");
  if (!bookId) {
    res.status(400).json({ error: "bookId is required" });
    return;
  }
  if (!getBookById(bookId)) {
    res.status(404).json({ error: "Unknown bookId" });
    return;
  }
  res.json({ units: getUnitsForBook(bookId) });
});

curriculumRouter.get("/curriculum/lessons", (req, res) => {
  const unitId = String(req.query.unitId ?? "");
  if (!unitId) {
    res.status(400).json({ error: "unitId is required" });
    return;
  }
  if (!getUnitById(unitId)) {
    res.status(404).json({ error: "Unknown unitId" });
    return;
  }
  // Lessons carry `outcomes`; objectives have their own endpoint, so keep this
  // response about navigation rather than shipping the same data twice.
  res.json({
    lessons: getLessonsForUnit(unitId).map(l => ({
      id: l.id,
      unitId: l.unitId,
      title: l.title,
      titleAr: l.titleAr,
      estimatedDuration: l.estimatedDuration,
      objectiveCount: l.outcomes.length,
    })),
  });
});

/**
 * Objectives by scope. Exactly one of lessonId / unitId / bookId.
 *
 * `bloomsCoverage` rides along so a caller can see at a glance how much of the
 * returned set carries a real cognitive classification — the difference between
 * a meaningful competency breakdown and four bars built on a default value.
 */
curriculumRouter.get("/curriculum/objectives", (req, res) => {
  const lessonId = req.query.lessonId ? String(req.query.lessonId) : undefined;
  const unitId = req.query.unitId ? String(req.query.unitId) : undefined;
  const bookId = req.query.bookId ? String(req.query.bookId) : undefined;

  const provided = [lessonId, unitId, bookId].filter(Boolean);
  if (provided.length !== 1) {
    res.status(400).json({ error: "Provide exactly one of lessonId, unitId, bookId" });
    return;
  }

  let objectives: CurriculumObjective[];
  if (lessonId) {
    if (!getLessonById(lessonId)) {
      res.status(404).json({ error: "Unknown lessonId" });
      return;
    }
    objectives = getObjectivesForLesson(lessonId);
  } else if (unitId) {
    if (!getUnitById(unitId)) {
      res.status(404).json({ error: "Unknown unitId" });
      return;
    }
    objectives = getObjectivesForUnit(unitId);
  } else {
    if (!getBookById(bookId!)) {
      res.status(404).json({ error: "Unknown bookId" });
      return;
    }
    objectives = getObjectivesForBook(bookId!);
  }

  res.json({
    objectives: objectives.map(publicObjective),
    bloomsCoverage: bloomsCoverage(bookId),
  });
});

/**
 * Resolve a set of objective ids, reporting which don't exist.
 *
 * Evaluation generation calls this before doing anything else: a teacher who
 * picked three objectives and silently got questions for two would see a
 * plausible evaluation measuring the wrong thing.
 */
curriculumRouter.post("/curriculum/objectives/resolve", (req, res) => {
  const ids: unknown = req.body?.objectiveIds;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
    res.status(400).json({ error: "objectiveIds must be an array of strings" });
    return;
  }
  const { found, missing } = resolveObjectiveIds(ids as string[]);
  res.json({ objectives: found.map(publicObjective), missing });
});

export default curriculumRouter;
