/**
 * The body of `POST /evaluations/from-worksheet`, checked before anything is
 * looked up or stored. The worksheet comes from the app as JSON a teacher may
 * have edited, so nothing in it is trusted: the shape is rebuilt field by field,
 * which also drops whatever else the client sent along.
 */
import type { WorksheetFormatInput, WorksheetInput } from "./fromWorksheet.ts";

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

/** Caps on a structured format's lists, and on each item in them. */
const MAX_FORMAT_ITEMS = 10;
const MAX_FORMAT_ITEM_CHARS = 300;

const textList = (v: unknown, min = 1): string[] | null =>
  Array.isArray(v)
  && v.length >= min
  && v.length <= MAX_FORMAT_ITEMS
  && v.every(x => typeof x === "string" && x.trim() !== "" && x.length <= MAX_FORMAT_ITEM_CHARS)
    ? (v as string[]).map(x => x.trim())
    : null;
const indexList = (v: unknown, length: number, below: number): number[] | null =>
  Array.isArray(v) && v.length === length && v.every(x => Number.isInteger(x) && x >= 0 && x < below)
    ? (v as number[])
    : null;

/**
 * A question's structured format, rebuilt field by field. Anything malformed
 * returns undefined and the question simply travels without it: `text` still
 * holds the whole question, so the text rules apply and the request is not
 * refused for a field the teacher never typed.
 */
function parseFormat(raw: unknown): WorksheetFormatInput | undefined {
  if (!isObject(raw)) return undefined;
  const stem = text(raw["stem"]);
  if (!stem) return undefined;

  switch (raw["kind"]) {
    case "match": {
      const left = textList(raw["left"], 2);
      const right = textList(raw["right"], 2);
      const pairs = left && right ? indexList(raw["pairs"], left.length, right.length) : null;
      return left && right && pairs ? { kind: "match", stem, left, right, pairs } : undefined;
    }
    case "order": {
      const steps = textList(raw["steps"], 2);
      const order = steps ? indexList(raw["order"], steps.length, steps.length) : null;
      return steps && order ? { kind: "order", stem, steps, order } : undefined;
    }
    case "spot_error": {
      const steps = textList(raw["steps"], 3);
      const wrongStep = raw["wrongStep"];
      if (!steps || typeof wrongStep !== "number" || !Number.isInteger(wrongStep) || wrongStep < 0 || wrongStep >= steps.length) return undefined;
      if (typeof raw["fix"] !== "string" || typeof raw["why"] !== "string") return undefined;
      return { kind: "spot_error", stem, steps, wrongStep, fix: raw["fix"].trim(), why: raw["why"].trim() };
    }
    case "graph": {
      const exprs = textList(raw["exprs"]);
      const w = raw["window"];
      if (!exprs || !isObject(w)) return undefined;
      const { xMin, xMax, yMin, yMax } = w;
      const nums = [xMin, xMax, yMin, yMax];
      if (!nums.every(n => typeof n === "number" && Number.isFinite(n))) return undefined;
      if ((xMin as number) >= (xMax as number) || (yMin as number) >= (yMax as number)) return undefined;
      return { kind: "graph", stem, exprs, window: { xMin: xMin as number, xMax: xMax as number, yMin: yMin as number, yMax: yMax as number } };
    }
    default:
      return undefined;
  }
}

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
      const format = parseFormat(q["format"]);
      questions.push({
        text: text(q["text"]),
        points,
        ...(Array.isArray(options) && options.length ? { options: options as string[] } : {}),
        ...(figure ? { figure } : {}),
        ...(format ? { format } : {}),
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
