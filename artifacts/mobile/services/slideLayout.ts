/**
 * Which shape a slide should be drawn in, resolved once for all three
 * renderers.
 *
 * Until now every teaching slide in every deck rendered identically: a title
 * and a column of bullet lines. Two tools generating genuinely different
 * content still produced decks that looked the same, because the difference
 * never reached the eye — there was only one layout to reach it through.
 *
 * `ActivitySlide.layout` is a HINT, not a type. It decorates the existing
 * types rather than joining them, because `type` drives behaviour all over the
 * app — timers, answer keys, where a video gets inserted, which accent colour
 * is used — and a new member of that union would have to be audited against
 * every one of those. A layout changes only how the slide is drawn, so a
 * renderer that has never heard of one simply ignores it.
 *
 * This module is the single place that decides whether a layout's data is good
 * enough to draw. It fails to `null` — meaning "render it the ordinary way" —
 * rather than letting a renderer draw half a comparison or a statistic with no
 * number in it. A slide that quietly falls back looks unremarkable; a slide
 * that half-renders looks broken, and it does so on a wall in front of a class.
 *
 * Pure and react-free so it can be tested by the bare `node --test` runner.
 */
import type { ActivitySlide } from './ai/AIService.ts';
import { isBulletLine, stripBullet } from './deckText.ts';
import type { PhotoCredit } from './photoCredit.ts';

export type ResolvedLayout =
  | { kind: 'statement'; text: string }
  | { kind: 'stat'; value: string; label: string; source?: string }
  | { kind: 'compare'; leftTitle: string; left: string[]; rightTitle: string; right: string[] }
  | { kind: 'steps'; steps: string[] }
  | { kind: 'timeline'; events: { label: string; text: string }[] }
  | { kind: 'stats'; items: { value: string; label: string }[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'flow'; nodes: string[]; cycle: boolean }
  | { kind: 'quote'; text: string; by?: string }
  | { kind: 'concepts'; items: string[] }
  | { kind: 'cycle'; stages: { label: string; note?: string }[] }
  | { kind: 'tree'; root: string; branches: { label: string; leaves: string[] }[] }
  | { kind: 'venn'; sets: { label: string; only: string[] }[]; shared: string[] }
  | { kind: 'mindmap'; center: string; nodes: { text: string; role?: 'cause' | 'effect' }[] }
  | { kind: 'photo'; url: string; caption: string; credit?: PhotoCredit; sentence: string };

/**
 * A statement is one sentence, not a paragraph with the bullets removed.
 * Past this length it stops reading as a statement on a projector and starts
 * reading as a wall of text set in display type, which is worse than the
 * ordinary layout it replaced.
 */
export const MAX_STATEMENT_CHARS = 140;

/** A figure has to stay legible at display size. */
export const MAX_STAT_VALUE_CHARS = 12;

/** Two steps are a pair, not a process; below this the numbering is noise. */
const MIN_STEPS = 2;

// ─── Limits of the four structure layouts ────────────────────────────────────
// Each is a legibility ceiling, not a taste: past it the layout stops being the
// readable object it was chosen to be and becomes a wall of small text, which
// is the thing the ordinary layout would have been honest about.

/** A timeline of two is a pair; of seven is a list. */
export const MIN_TIMELINE_EVENTS = 3;
export const MAX_TIMELINE_EVENTS = 6;
export const MAX_TIMELINE_LABEL_CHARS = 24;
export const MAX_TIMELINE_TEXT_CHARS = 120;

export const MIN_STATS = 2;
export const MAX_STATS = 4;
export const MAX_STAT_LABEL_CHARS = 60;

export const MIN_TABLE_COLUMNS = 2;
export const MAX_TABLE_COLUMNS = 4;
export const MIN_TABLE_ROWS = 2;
export const MAX_TABLE_ROWS = 6;
export const MAX_TABLE_HEADER_CHARS = 30;
export const MAX_TABLE_CELL_CHARS = 80;

/** A flow of two is an arrow; seven boxes no longer fit on one slide. */
export const MIN_FLOW_NODES = 3;
export const MAX_FLOW_NODES = 6;
export const MAX_FLOW_NODE_CHARS = 60;

/** A quote is a sentence or two set large; past this it is a paragraph in display type. */
export const MAX_QUOTE_CHARS = 200;
export const MAX_QUOTE_BY_CHARS = 60;

/**
 * A grid of short key terms. Past this length an item is a sentence, and a
 * sentence in a card is worse than the bullet list it replaced; two items is a
 * pair, and seven no longer fit as large cards.
 */
export const MIN_CONCEPTS = 2;
export const MAX_CONCEPTS = 6;
export const MAX_CONCEPT_CHARS = 32;

export const MIN_CYCLE_STAGES = 3;
export const MAX_CYCLE_STAGES = 6;
export const MAX_DIAGRAM_LABEL_CHARS = 24;
export const MAX_CYCLE_NOTE_CHARS = 60;
export const MAX_TREE_ROOT_CHARS = 32;
export const MIN_TREE_BRANCHES = 2;
export const MAX_TREE_BRANCHES = 4;
export const MAX_TREE_LEAVES = 4;
export const MAX_VENN_ITEMS = 4;
export const MAX_VENN_ITEM_CHARS = 32;
/**
 * Three circles leave a third of the room per region. The item cap is 16, not
 * 20: at 20 an all-capitals Latin phrase («CHLOROFLUOROCARBONS», «MITOCHONDRIA
 * ORGANELLE») wrapped in the triple overlap and was cut off in the PDF and ran
 * over the circle's edge in the presenter (seen 2026-10-31); at 16 a two-word
 * capitals phrase fits in both. Ordinary Arabic and mixed-case English fit at 20.
 */
export const MAX_VENN3_ONLY = 3;
export const MAX_VENN3_SHARED = 2;
export const MAX_VENN3_ITEM_CHARS = 16;
export const MIN_MINDMAP_NODES = 3;
export const MAX_MINDMAP_NODES = 6;
export const MAX_MINDMAP_CHARS = 40;

/** Labels a reader tells apart: no repeats after trimming. */
function distinct(items: string[]): boolean {
  return new Set(items).size === items.length;
}

/** A required string: trimmed, bullet-stripped, non-empty, within `max`. Anything else is `null`. */
function needText(v: unknown, max: number): string | null {
  // A bare number is a normal thing for a model to put in a table cell or a
  // stat's value; read it as the text it would have been.
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return null;
  const t = stripBullet(v).trim();
  return t && t.length <= max ? t : null;
}

/** Every item through `needText`, or `null` if any single one fails — a list with a hole is not repaired. */
function needTexts(items: unknown, max: number): string[] | null {
  if (!Array.isArray(items)) return null;
  const out: string[] = [];
  for (const i of items) {
    const t = needText(i, max);
    if (t === null) return null;
    out.push(t);
  }
  return out;
}

function lines(content: string | undefined): string[] {
  return (content ?? '').split('\n').map(l => l.trim()).filter(Boolean);
}

function cleanList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(i => (typeof i === 'string' ? stripBullet(i).trim() : ''))
    .filter(Boolean);
}

/**
 * The layout this slide should be drawn in, or `null` for the ordinary one.
 *
 * Callers render `null` exactly as they always have — that is the contract
 * that lets a layout be added to one renderer at a time without any renderer
 * ever showing an empty slide.
 */
export function resolveSlideLayout(slide: ActivitySlide): ResolvedLayout | null {
  switch (slide.layout) {
    case 'statement': {
      const body = lines(slide.content);
      // More than one line is a list wearing a statement's clothes.
      if (body.length !== 1) return null;
      const text = stripBullet(body[0]!);
      if (!text || text.length > MAX_STATEMENT_CHARS) return null;
      return { kind: 'statement', text };
    }

    case 'stat': {
      const value = (slide.stat?.value ?? '').trim();
      const label = (slide.stat?.label ?? '').trim();
      // A stat slide with no figure is just a heading set very large.
      if (!value || value.length > MAX_STAT_VALUE_CHARS) return null;
      if (!label) return null;
      const source = (slide.stat?.source ?? '').trim();
      return { kind: 'stat', value, label, ...(source ? { source } : {}) };
    }

    case 'compare': {
      const leftTitle = (slide.compare?.leftTitle ?? '').trim();
      const rightTitle = (slide.compare?.rightTitle ?? '').trim();
      const left = cleanList(slide.compare?.left);
      const right = cleanList(slide.compare?.right);
      // Both columns must stand up. One empty side is not a comparison, and
      // renders as a lopsided slide with a heading over nothing.
      if (!leftTitle || !rightTitle || left.length === 0 || right.length === 0) return null;
      return { kind: 'compare', leftTitle, left, rightTitle, right };
    }

    case 'steps': {
      const body = lines(slide.content);
      const steps = body.filter(isBulletLine).map(stripBullet).filter(Boolean);
      // Fall back rather than numbering prose that was never a sequence.
      if (steps.length < MIN_STEPS) return null;
      return { kind: 'steps', steps };
    }

    case 'timeline': {
      if (!Array.isArray(slide.timeline)) return null;
      const events: { label: string; text: string }[] = [];
      for (const e of slide.timeline) {
        const label = needText((e as { label?: unknown } | null)?.label, MAX_TIMELINE_LABEL_CHARS);
        const text = needText((e as { text?: unknown } | null)?.text, MAX_TIMELINE_TEXT_CHARS);
        // An event with no date or no description is not drawn short — the whole
        // timeline is refused, because a missing one reorders nothing visibly
        // and quietly makes the sequence a different sequence.
        if (label === null || text === null) return null;
        events.push({ label, text });
      }
      if (events.length < MIN_TIMELINE_EVENTS || events.length > MAX_TIMELINE_EVENTS) return null;
      return { kind: 'timeline', events };
    }

    case 'stats': {
      if (!Array.isArray(slide.stats)) return null;
      const items: { value: string; label: string }[] = [];
      for (const st of slide.stats) {
        const value = needText((st as { value?: unknown } | null)?.value, MAX_STAT_VALUE_CHARS);
        const label = needText((st as { label?: unknown } | null)?.label, MAX_STAT_LABEL_CHARS);
        if (value === null || label === null) return null;
        items.push({ value, label });
      }
      if (items.length < MIN_STATS || items.length > MAX_STATS) return null;
      return { kind: 'stats', items };
    }

    case 'table': {
      const headers = needTexts(slide.table?.headers, MAX_TABLE_HEADER_CHARS);
      if (!headers || headers.length < MIN_TABLE_COLUMNS || headers.length > MAX_TABLE_COLUMNS) return null;
      const rawRows = slide.table?.rows;
      if (!Array.isArray(rawRows) || rawRows.length < MIN_TABLE_ROWS || rawRows.length > MAX_TABLE_ROWS) return null;
      const rows: string[][] = [];
      for (const raw of rawRows) {
        const cells = needTexts(raw, MAX_TABLE_CELL_CHARS);
        // One cell per header, exactly. A short row padded with blanks or a long
        // one cut would shift every value after the gap under the wrong heading.
        if (!cells || cells.length !== headers.length) return null;
        rows.push(cells);
      }
      return { kind: 'table', headers, rows };
    }

    case 'flow': {
      const nodes = needTexts(slide.flow?.steps, MAX_FLOW_NODE_CHARS);
      if (!nodes || nodes.length < MIN_FLOW_NODES || nodes.length > MAX_FLOW_NODES) return null;
      return { kind: 'flow', nodes, cycle: slide.flow?.cycle === true };
    }

    case 'quote': {
      const text = needText(slide.quote?.text, MAX_QUOTE_CHARS);
      if (text === null) return null;
      // An attribution that is present but unusable refuses the whole quote: a
      // quote cut loose from who said it is a different claim.
      const rawBy = slide.quote?.by;
      const by = rawBy === undefined || rawBy === null || rawBy === '' ? undefined : needText(rawBy, MAX_QUOTE_BY_CHARS);
      if (by === null) return null;
      return { kind: 'quote', text, ...(by ? { by } : {}) };
    }

    case 'concepts': {
      const items = needTexts(slide.concepts, MAX_CONCEPT_CHARS);
      if (!items || items.length < MIN_CONCEPTS || items.length > MAX_CONCEPTS) return null;
      return { kind: 'concepts', items };
    }

    case 'cycle': {
      const raw = slide.cycle?.stages;
      if (!Array.isArray(raw) || raw.length < MIN_CYCLE_STAGES || raw.length > MAX_CYCLE_STAGES) return null;
      const stages: { label: string; note?: string }[] = [];
      for (const s of raw) {
        const label = needText(s?.label, MAX_DIAGRAM_LABEL_CHARS);
        if (label === null) return null;
        const rawNote = s?.note;
        const note = rawNote === undefined || rawNote === null || rawNote === '' ? undefined : needText(rawNote, MAX_CYCLE_NOTE_CHARS);
        if (note === null) return null;
        stages.push({ label, ...(note ? { note } : {}) });
      }
      return distinct(stages.map(s => s.label)) ? { kind: 'cycle', stages } : null;
    }

    case 'tree': {
      const root = needText(slide.tree?.root, MAX_TREE_ROOT_CHARS);
      const raw = slide.tree?.branches;
      if (root === null || !Array.isArray(raw) || raw.length < MIN_TREE_BRANCHES || raw.length > MAX_TREE_BRANCHES) return null;
      const branches: { label: string; leaves: string[] }[] = [];
      for (const b of raw) {
        const label = needText(b?.label, MAX_DIAGRAM_LABEL_CHARS);
        const leaves = b?.leaves === undefined ? [] : needTexts(b.leaves, MAX_DIAGRAM_LABEL_CHARS);
        if (label === null || leaves === null || leaves.length > MAX_TREE_LEAVES || !distinct(leaves)) return null;
        branches.push({ label, leaves });
      }
      return distinct(branches.map(b => b.label)) ? { kind: 'tree', root, branches } : null;
    }

    case 'venn': {
      const raw = slide.venn?.sets;
      if (!Array.isArray(raw) || raw.length < 2 || raw.length > 3) return null;
      const three = raw.length === 3;
      const itemChars = three ? MAX_VENN3_ITEM_CHARS : MAX_VENN_ITEM_CHARS;
      const sets: { label: string; only: string[] }[] = [];
      for (const s of raw) {
        const label = needText(s?.label, MAX_DIAGRAM_LABEL_CHARS);
        const only = needTexts(s?.only ?? [], itemChars);
        if (label === null || only === null || only.length > (three ? MAX_VENN3_ONLY : MAX_VENN_ITEMS)) return null;
        sets.push({ label, only });
      }
      const shared = needTexts(slide.venn?.shared ?? [], itemChars);
      if (shared === null || shared.length > (three ? MAX_VENN3_SHARED : MAX_VENN_ITEMS)) return null;
      if (!distinct(sets.map(s => s.label))) return null;
      if (shared.length === 0 && sets.every(s => s.only.length === 0)) return null;
      return { kind: 'venn', sets, shared };
    }

    case 'mindmap': {
      const center = needText(slide.mindmap?.center, MAX_MINDMAP_CHARS);
      const raw = slide.mindmap?.nodes;
      if (center === null || !Array.isArray(raw) || raw.length < MIN_MINDMAP_NODES || raw.length > MAX_MINDMAP_NODES) return null;
      const nodes: { text: string; role?: 'cause' | 'effect' }[] = [];
      for (const n of raw) {
        const text = needText(n?.text, MAX_MINDMAP_CHARS);
        const role = n?.role;
        if (text === null || (role !== undefined && role !== 'cause' && role !== 'effect')) return null;
        nodes.push({ text, ...(role ? { role } : {}) });
      }
      return distinct(nodes.map(n => n.text)) ? { kind: 'mindmap', center, nodes } : null;
    }

    case 'photo': {
      // Needs a real picture and one sentence to put over it. Without the
      // picture this is `null` — the ordinary layout, with the sentence as a
      // line of text — never a dark slide with a title floating on it.
      const url = typeof slide.sideImageUrl === 'string' ? slide.sideImageUrl.trim() : '';
      if (!url) return null;
      const body = lines(slide.content);
      if (body.length > 1) return null;
      const sentence = body.length ? stripBullet(body[0]!) : '';
      if (sentence.length > MAX_STATEMENT_CHARS) return null;
      return {
        kind: 'photo',
        url,
        sentence,
        caption: slide.sideImageCaption ?? '',
        ...(slide.sideImageCredit ? { credit: slide.sideImageCredit } : {}),
      };
    }

    default:
      return null;
  }
}

/** The layouts whose data lives in a field of its own rather than in `content`. */
export const PAYLOAD_LAYOUTS = ['stat', 'compare', 'timeline', 'stats', 'table', 'flow', 'quote', 'concepts', 'cycle', 'tree', 'venn', 'mindmap'] as const;

/**
 * A slide's own words as bullet lines, from whichever payload it carries — for
 * a slide that asked for a layout the gate refused and has no `content` to fall
 * back on. Without this, refusing a thin timeline would leave a blank slide;
 * with it the teacher sees the events as a list, which is the ordinary layout
 * doing its job.
 */
export function payloadLines(slide: ActivitySlide): string[] {
  const str = (v: unknown) => (typeof v === 'string' ? stripBullet(v).trim() : '');
  const out: string[] = [];
  const add = (...parts: unknown[]) => {
    const joined = parts.map(str).filter(Boolean).join(' — ');
    if (joined) out.push(joined);
  };
  for (const e of Array.isArray(slide.timeline) ? slide.timeline : []) add(e?.label, e?.text);
  for (const st of Array.isArray(slide.stats) ? slide.stats : []) add(st?.value, st?.label);
  if (slide.table && Array.isArray(slide.table.rows)) {
    const headers = Array.isArray(slide.table.headers) ? slide.table.headers : [];
    for (const row of slide.table.rows) {
      if (Array.isArray(row)) add(...row.map((c, i) => (headers[i] ? `${str(headers[i])}: ${str(c)}` : c)));
    }
  }
  for (const step of Array.isArray(slide.flow?.steps) ? slide.flow!.steps : []) add(step);
  if (slide.quote) add(slide.quote.text, slide.quote.by);
  for (const c of Array.isArray(slide.concepts) ? slide.concepts : []) add(c);
  for (const s of Array.isArray(slide.cycle?.stages) ? slide.cycle!.stages : []) add(s?.label, s?.note);
  if (slide.tree) {
    add(slide.tree.root);
    for (const b of Array.isArray(slide.tree.branches) ? slide.tree.branches : []) add(b?.label, ...(Array.isArray(b?.leaves) ? b.leaves : []));
  }
  if (slide.venn) {
    for (const s of Array.isArray(slide.venn.sets) ? slide.venn.sets : []) add(s?.label, ...(Array.isArray(s?.only) ? s.only : []));
    for (const x of Array.isArray(slide.venn.shared) ? slide.venn.shared : []) add(x);
  }
  if (slide.mindmap) {
    add(slide.mindmap.center);
    for (const n of Array.isArray(slide.mindmap.nodes) ? slide.mindmap.nodes : []) add(n?.text);
  }
  return out;
}

/**
 * A `photo` slide in the shape the cover and section-break drawing already
 * understands: the picture as `mediaUrl`, its credit as `mediaCaption` and
 * `mediaCredit`. The three renderers draw it with the code that draws those two
 * slides, so the licence line that rides with the photo is drawn by the one
 * place that has been checked for it, not by a fourth copy.
 */
export function asPhotoHero(slide: ActivitySlide): ActivitySlide | null {
  const layout = resolveSlideLayout(slide);
  if (layout?.kind !== 'photo') return null;
  const { sideImageUrl: _u, sideImageCaption: _c, sideImageCredit: _k, ...rest } = slide;
  return {
    ...rest,
    content: layout.sentence,
    mediaUrl: layout.url,
    mediaCaption: layout.caption || undefined,
    mediaCredit: layout.credit,
  };
}

/** Arabic-Indic digits to a number, so «١) … ٢)» numbers like «1) … 2)». */
function markerValue(raw: string): number {
  return Number(raw.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
}

/** The longest lead-in («الخطوات:») that is a label rather than a first step. */
const MAX_STEPS_LEAD_CHARS = 24;

/** Three is a process; two numbered clauses are just a sentence with a list in it. */
const MIN_INLINE_STEPS = 3;

/**
 * A procedure the book wrote on ONE line — «الخطوات: 1) عزل y 2) تعويضه
 * 3) حل المعادلة» — as its steps, or `null` when the line is not one.
 *
 * Strict on purpose, because the answer to "no" is the ordinary rendering and
 * the answer to a wrong "yes" is a slide numbered wrongly in front of a class:
 * the markers must count 1, 2, 3… in order with nothing skipped, there must be
 * at least three, every step must have text, and anything before the first
 * marker must be a short label. A marker is a number and `)` or `.` standing
 * after whitespace or a colon and followed by whitespace, so «13.6 / n²» and
 * «f(2) = 5» are not read as steps.
 */
export function inlineSteps(text: string): string[] | null {
  const line = stripBullet(text ?? '');
  const markers = [...line.matchAll(/(?:^|[\s:：])([0-9٠-٩]{1,2})\s*[).](?=\s)/g)];
  if (markers.length < MIN_INLINE_STEPS) return null;
  if (!markers.every((m, i) => markerValue(m[1]!) === i + 1)) return null;

  // The match may have eaten the whitespace or colon before the digits, so the
  // number's own position is found inside it; a step's text runs from the end
  // of its marker to where the next number begins.
  const numberAt = markers.map(m => m.index! + m[0].indexOf(m[1]!));
  const lead = line.slice(0, numberAt[0]!).replace(/[:：\s]+$/, '').trim();
  if (lead.length > MAX_STEPS_LEAD_CHARS) return null;

  const steps = markers.map((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < numberAt.length ? numberAt[i + 1]! : line.length;
    return line.slice(from, to).replace(/[\s;,،؛]+$/, '').trim();
  });
  return steps.every(Boolean) ? steps : null;
}

/** Every layout a generator may ask for — the prompt and the tests share this. */
export const SLIDE_LAYOUTS = ['statement', 'stat', 'compare', 'steps', 'timeline', 'stats', 'table', 'flow', 'quote', 'photo', 'concepts', 'cycle', 'tree', 'venn', 'mindmap'] as const;
