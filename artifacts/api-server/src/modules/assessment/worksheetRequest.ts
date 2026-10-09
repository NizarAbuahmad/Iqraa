/**
 * The body of `POST /evaluations/from-worksheet`, checked before anything is
 * looked up or stored. The worksheet comes from the app as JSON a teacher may
 * have edited, so nothing in it is trusted: the shape is rebuilt field by field,
 * which also drops whatever else the client sent along.
 */
import type { WorksheetInput } from "./fromWorksheet.ts";

/** The same ceiling every other evaluation route holds. */
const MAX_QUESTIONS = 50;

export interface WorksheetRequest {
  worksheet: WorksheetInput;
  objectiveId: string;
  classGroupId: string;
  title: string;
  language: "ar" | "en";
}

type Parsed = { ok: true; value: WorksheetRequest } | { ok: false; error: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function parseWorksheetRequest(body: unknown): Parsed {
  if (!isObject(body) || !isObject(body["worksheet"])) return { ok: false, error: "A worksheet is required" };
  const ws = body["worksheet"];

  const rawSections = Array.isArray(ws["sections"]) ? ws["sections"] : [];
  const sections: WorksheetInput["sections"] = [];
  let count = 0;
  for (const sec of rawSections) {
    if (!isObject(sec) || !Array.isArray(sec["questions"])) return { ok: false, error: "A section has no questions list" };
    const questions: WorksheetInput["sections"][number]["questions"] = [];
    for (const q of sec["questions"]) {
      if (!isObject(q) || !text(q["text"])) return { ok: false, error: "A question has no text" };
      const points = Number(q["points"]);
      if (!Number.isFinite(points)) return { ok: false, error: "A question's points are not a number" };
      const options = q["options"];
      if (options !== undefined && (!Array.isArray(options) || options.some(o => typeof o !== "string"))) {
        return { ok: false, error: "A question's options are not text" };
      }
      const figure = isObject(q["figure"])
        ? { uri: text(q["figure"]["uri"]), caption: text(q["figure"]["caption"]) }
        : undefined;
      questions.push({
        text: text(q["text"]),
        points,
        ...(Array.isArray(options) && options.length ? { options: options as string[] } : {}),
        ...(figure ? { figure } : {}),
      });
    }
    count += questions.length;
    sections.push({ questions });
  }
  if (count === 0) return { ok: false, error: "The worksheet has no questions" };
  if (count > MAX_QUESTIONS) return { ok: false, error: `An evaluation may hold ${MAX_QUESTIONS} questions` };

  if (!Array.isArray(ws["answerKey"])) return { ok: false, error: "The answer key is missing" };
  const answerKey: WorksheetInput["answerKey"] = [];
  for (const k of ws["answerKey"]) {
    if (!isObject(k)) continue;
    const solution = Array.isArray(k["solution"]) ? k["solution"].filter((l): l is string => typeof l === "string") : undefined;
    answerKey.push({
      num: Number(k["num"]),
      answer: typeof k["answer"] === "string" ? k["answer"] : "",
      ...(solution?.length ? { solution } : {}),
    });
  }

  const objectiveId = text(body["objectiveId"]);
  if (!objectiveId) return { ok: false, error: "Pick the objective this worksheet practises" };
  const classGroupId = text(body["classGroupId"]);
  if (!classGroupId) return { ok: false, error: "Pick a class" };

  return {
    ok: true,
    value: {
      worksheet: { sections, answerKey },
      objectiveId,
      classGroupId,
      title: text(ws["title"]),
      language: body["language"] === "en" ? "en" : "ar",
    },
  };
}
