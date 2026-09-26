/**
 * The teacher's question editor, as data: a question's stored body ↔ the flat
 * form a teacher fills in.
 *
 * The shapes are the server's (`TYPE_CONTRACTS` in api-server's
 * `llmGenerator.ts`, checked by `questionTypes.ts` validate()). Validation
 * stays the server's job; this only builds the shape, so a refusal names the
 * real rule rather than a second copy of it drifting here.
 *
 * Editing spreads the stored body and answer first, so fields the form does
 * not show (a practical task's `materials`, an MC's `multiSelect`) survive.
 *
 * Pure on purpose — `evaluations.ts` imports the API client, which cannot be
 * loaded under `node --test`.
 */
import type { EvaluationQuestion, QuestionType } from './evaluations.ts';

export const EDITABLE_TYPES = [
  'multiple_choice',
  'true_false',
  'matching',
  'fill_blank',
  'short_answer',
  'open_ended',
  'problem_solving',
  'practical_task',
] as const satisfies readonly QuestionType[];

export type EditableType = (typeof EDITABLE_TYPES)[number];

export interface QuestionForm {
  /** stem / statement / prompt; for fill_blank the text with ____ gaps. */
  prompt: string;
  scenario: string;
  options: string[];
  /** Indexes into `options`. */
  correct: number[];
  truth: boolean;
  /** One entry per gap; accepted spellings separated by «/». */
  blanks: string[];
  /** A row with no left side is a distractor on the right. */
  pairs: { left: string; right: string }[];
  modelAnswer: string;
  /** keyConcepts or successCriteria, one per line. */
  list: string;
}

export interface QuestionPayload {
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  rubric?: Record<string, unknown>;
}

/**
 * A paper-grid row has an empty body: nothing to edit, the paper holds the
 * text. Read-aloud and dictation have their own composers.
 */
export function isEditableQuestion(q: Pick<EvaluationQuestion, 'type' | 'body'>): boolean {
  return (EDITABLE_TYPES as readonly string[]).includes(q.type) && Object.keys(q.body ?? {}).length > 0;
}

const GAP = /_{3,}(?:\s*\(\d+\))?/g;
const TOKEN = /\{\{\d+\}\}/g;

export function countGaps(text: string): number {
  return (text.match(GAP) ?? []).length;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const lines = (text: string): string[] => text.split('\n').map(l => l.trim()).filter(Boolean);

export function emptyForm(): QuestionForm {
  return {
    prompt: '',
    scenario: '',
    options: ['', '', '', ''],
    correct: [0],
    truth: true,
    blanks: [],
    pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
    modelAnswer: '',
    list: '',
  };
}

export function formFromQuestion(q: Pick<EvaluationQuestion, 'type' | 'body' | 'expectedAnswer'>): QuestionForm {
  const type = q.type as EditableType;
  const form = emptyForm();
  const body = q.body ?? {};
  const ans = q.expectedAnswer ?? {};
  switch (type) {
    case 'multiple_choice': {
      const options = arr(body['options']).map(rec);
      const correct = new Set(arr(ans['optionIds']).map(s));
      form.prompt = s(body['stem']);
      form.options = options.map(o => s(o['text']));
      form.correct = options.flatMap((o, i) => (correct.has(s(o['id'])) ? [i] : []));
      break;
    }
    case 'true_false':
      form.prompt = s(body['statement']);
      form.truth = ans['value'] !== false;
      break;
    case 'fill_blank':
      form.prompt = s(body['template']).replace(TOKEN, '____');
      form.blanks = arr(ans['blanks']).map(b => arr(rec(b)['accept']).map(s).join(' / '));
      break;
    case 'matching': {
      const left = new Map(arr(body['left']).map(rec).map(l => [s(l['id']), s(l['text'])]));
      const right = new Map(arr(body['right']).map(rec).map(r => [s(r['id']), s(r['text'])]));
      const paired = new Set<string>();
      form.pairs = arr(ans['pairs']).map(rec).map(p => {
        paired.add(s(p['right']));
        return { left: left.get(s(p['left'])) ?? '', right: right.get(s(p['right'])) ?? '' };
      });
      for (const [id, text] of right) if (!paired.has(id)) form.pairs.push({ left: '', right: text });
      break;
    }
    case 'practical_task':
      form.prompt = s(body['prompt']);
      form.list = arr(ans['successCriteria']).map(s).join('\n');
      break;
    default:
      form.prompt = s(body['prompt']);
      form.scenario = s(body['scenario']);
      form.modelAnswer = s(ans['modelAnswer']);
      form.list = arr(ans['keyConcepts']).map(s).join('\n');
  }
  return form;
}

/**
 * The body/answer to send. `existing` is the question being edited, or
 * undefined when adding; `marks` sizes the rubric a new open question needs.
 */
export function payloadFromForm(
  type: EditableType,
  form: QuestionForm,
  marks: number,
  existing?: Pick<EvaluationQuestion, 'body' | 'expectedAnswer'>,
): QuestionPayload {
  const body: Record<string, unknown> = { ...(existing?.body ?? {}) };
  const expectedAnswer: Record<string, unknown> = { ...(existing?.expectedAnswer ?? {}) };
  let rubric: Record<string, unknown> | undefined;

  switch (type) {
    case 'multiple_choice': {
      // Blank rows are dropped, so the correct marks are re-indexed with them.
      const kept = form.options.flatMap((text, i) => (text.trim() ? [{ text: text.trim(), i }] : []));
      const ids = 'abcdefgh';
      body['stem'] = form.prompt.trim();
      body['options'] = kept.map((o, k) => ({ id: ids[k], text: o.text }));
      expectedAnswer['optionIds'] = kept.flatMap((o, k) => (form.correct.includes(o.i) ? [ids[k]] : []));
      break;
    }
    case 'true_false':
      body['statement'] = form.prompt.trim();
      expectedAnswer['value'] = form.truth;
      break;
    case 'fill_blank': {
      let n = 0;
      body['template'] = form.prompt.trim().replace(GAP, () => `{{${++n}}}`);
      expectedAnswer['blanks'] = Array.from({ length: n }, (_, i) => ({
        accept: (form.blanks[i] ?? '').split('/').map(a => a.trim()).filter(Boolean),
      }));
      break;
    }
    case 'matching': {
      const rows = form.pairs.map(p => ({ left: p.left.trim(), right: p.right.trim() }));
      const left: { id: string; text: string }[] = [];
      const right: { id: string; text: string }[] = [];
      const pairs: { left: string; right: string }[] = [];
      for (const row of rows) {
        const r = row.right ? { id: `r${right.length + 1}`, text: row.right } : undefined;
        if (r) right.push(r);
        if (!row.left) continue;
        const l = { id: `l${left.length + 1}`, text: row.left };
        left.push(l);
        if (r) pairs.push({ left: l.id, right: r.id });
      }
      body['left'] = left;
      body['right'] = right;
      expectedAnswer['pairs'] = pairs;
      break;
    }
    case 'practical_task':
      body['prompt'] = form.prompt.trim();
      expectedAnswer['successCriteria'] = lines(form.list);
      break;
    default: {
      body['prompt'] = form.prompt.trim();
      if (type === 'problem_solving') body['scenario'] = form.scenario.trim();
      const concepts = lines(form.list);
      expectedAnswer['modelAnswer'] = form.modelAnswer.trim();
      expectedAnswer['keyConcepts'] = concepts;
      // A new open question needs a rubric (open_ended, problem_solving
      // require one). The key concepts are what the grader checks meaning
      // against, so they are the criteria; an edit keeps the stored rubric.
      if (!existing && concepts.length > 0) {
        const each = Math.round((marks / concepts.length) * 100) / 100;
        rubric = { criteria: concepts.map(label => ({ label, marks: each })) };
      }
    }
  }
  return { body, expectedAnswer, ...(rubric ? { rubric } : {}) };
}
