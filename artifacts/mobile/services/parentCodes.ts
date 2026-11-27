/**
 * «رموز أولياء الأمور» — a class's per-student link codes in one place (`app/classes/[id]/parent-codes.tsx`), over
 * `GET/POST /classes/:id/claim-codes`. Pure: no react-native import, so `node --test` loads it.
 *
 * The codes stay one per child. Whoever redeems one is linked to THAT child at once, with no approval, so the screen
 * never offers to post them all in one message: it shares one family's code at a time, or prints one slip per child to
 * be handed out. `slipsHtml` builds that sheet.
 */
import { escAttr } from './htmlEscape.ts';
import type { RosterStudent } from './roster.ts';

export interface ClassCode {
  studentId: string;
  claimCode: string | null;
  claimCodeExpiresAt: string | null;
}

export interface ParentCodeRow {
  studentId: string;
  name: string;
  code: string | null;
  expiresAt: string | null;
  /** A parent (guardian) account is already linked to this child. */
  hasParent: boolean;
}

export type ParentCodeFilter = 'waiting' | 'all';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The `codes` of a 2xx body, or null when it is not a list (a proxy's page, an empty body): never «no codes». */
export function normalizeClassCodes(json: unknown): ClassCode[] | null {
  if (!isRecord(json) || !Array.isArray(json['codes'])) return null;
  return json['codes'].flatMap((c): ClassCode[] => {
    if (!isRecord(c) || typeof c['studentId'] !== 'string' || c['studentId'] === '') return [];
    const code = typeof c['claimCode'] === 'string' && c['claimCode'] !== '' ? c['claimCode'] : null;
    return [{
      studentId: c['studentId'],
      claimCode: code,
      claimCodeExpiresAt: code && typeof c['claimCodeExpiresAt'] === 'string' ? c['claimCodeExpiresAt'] : null,
    }];
  });
}

/** The name a family recognises: the Arabic one in Arabic when the teacher recorded it. */
export function studentName(s: Pick<RosterStudent, 'displayName' | 'displayNameAr'>, lang: 'ar' | 'en'): string {
  return (lang === 'ar' && s.displayNameAr?.trim()) || s.displayName;
}

/**
 * One row per student of the class page's roster (its order), with that student's code. A student the codes list
 * does not name has no code; a code for a student not on the roster is dropped.
 */
export function parentCodeRows(
  students: readonly Pick<RosterStudent, 'id' | 'displayName' | 'displayNameAr' | 'links'>[],
  codes: readonly ClassCode[],
  lang: 'ar' | 'en',
): ParentCodeRow[] {
  const byId = new Map(codes.map(c => [c.studentId, c]));
  return students.map(s => {
    const c = byId.get(s.id);
    return {
      studentId: s.id,
      name: studentName(s, lang),
      code: c?.claimCode ?? null,
      expiresAt: c?.claimCode ? c.claimCodeExpiresAt : null,
      hasParent: (s.links ?? []).some(l => l.relation === 'guardian'),
    };
  });
}

/** `waiting`: only children with no parent linked yet, the ones a slip is still for. */
export function filterRows(rows: readonly ParentCodeRow[], filter: ParentCodeFilter): ParentCodeRow[] {
  return filter === 'all' ? [...rows] : rows.filter(r => !r.hasParent);
}

/** How many students have no live code: what «أنشئ الرموز الناقصة» would mint. */
export function missingCount(rows: readonly ParentCodeRow[]): number {
  return rows.filter(r => r.code === null).length;
}

export interface SlipText {
  title: string;
  studentLabel: string;
  codeLabel: string;
  expiresLabel: string;
  howTo: string;
  privateNote: string;
}

/**
 * A printable sheet: one slip per child with a code, two to a row, cut along the dashed lines. Every string from the
 * roster is escaped; the code sits in a left-to-right box of its own so it reads the same in an Arabic slip. Rows with
 * no code are left out (there is nothing to hand over yet).
 */
export function slipsHtml(
  rows: readonly ParentCodeRow[],
  opts: { lang: 'ar' | 'en'; className: string; teacherName: string; formatDate: (iso: string) => string; text: SlipText },
): string {
  const { lang, className, teacherName, formatDate, text } = opts;
  const rtl = lang === 'ar';
  const slips = rows
    .filter((r): r is ParentCodeRow & { code: string } => r.code !== null)
    .map(r => `
      <div class="slip">
        <div class="title">${escAttr(text.title)}</div>
        <div class="line"><span class="label">${escAttr(text.studentLabel)}:</span> <b>${escAttr(r.name)}</b></div>
        <div class="line label">${escAttr(text.codeLabel)}:</div>
        <div class="code" dir="ltr">${escAttr(r.code)}</div>
        ${r.expiresAt ? `<div class="line small">${escAttr(text.expiresLabel)}: <bdi>${escAttr(formatDate(r.expiresAt))}</bdi></div>` : ''}
        <div class="line small">${escAttr(text.howTo)}</div>
        <div class="line small strong">${escAttr(text.privateNote)}</div>
        <div class="line small muted">${escAttr([className, teacherName].filter(Boolean).join(' · '))}</div>
      </div>`)
    .join('');
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escAttr(text.title)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Almarai', 'Readex Pro', Arial, sans-serif; color: #111; margin: 0; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .slip { border: 1px dashed #888; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
  .title { font-weight: 700; font-size: 14px; margin-bottom: 6px; }
  .line { font-size: 13px; line-height: 1.6; }
  .label { color: #444; }
  .code { font-family: 'Courier New', monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; text-align: center; border: 1px solid #111; border-radius: 6px; padding: 4px 0; margin: 4px 0 6px; }
  .small { font-size: 11.5px; }
  .strong { font-weight: 700; }
  .muted { color: #555; }
</style>
</head>
<body><div class="sheet">${slips}</div></body>
</html>`;
}
