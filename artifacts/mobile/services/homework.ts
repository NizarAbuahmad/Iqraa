/**
 * «الواجبات» — pure types and helpers shared by the student, parent and
 * teacher screens. No imports on purpose: this file is loaded by bare
 * `node --test`, so nothing here may touch react-native, expo or `apiClient`.
 * The fetchers live in `homeworkApi.ts`.
 *
 * A due date is a calendar day (`YYYY-MM-DD`) in Asia/Amman, never a
 * timestamp. Amman has been on UTC+3 all year since 2022, so "today" is the UTC
 * clock plus three hours; a device in another timezone must still agree with
 * the server about whether a homework is late.
 *
 * Compare dates as strings or through `Date.UTC` — never `new Date('YYYY-MM-DD')`
 * in local time, which shifts the day in any zone west of UTC.
 */

export type HomeworkState = 'done' | 'overdue' | 'open';

/**
 * A Library item attached to a homework, as the server stored it when it was
 * attached (the same snapshot a class shelf keeps). Opens like a shelf row —
 * `openTargetFor` in classResources.ts.
 */
export interface HomeworkLibraryResource {
  kind: 'library';
  source: string;
  nativeId: string;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
}

/**
 * One of the teacher's own saved materials (ملفاتي). A family opens it
 * read-only and without its answers, through
 * GET /{student|parent}/homework/:id/materials/:materialId — the screen is
 * `/workspace/view?hw=…&material=…`.
 */
export interface HomeworkMaterialResource {
  kind: 'material';
  materialId: string;
  title: string;
  /** The saved material's type, e.g. `quiz` or `worksheet`. */
  type: string;
}

/**
 * One of a lesson's term games (services/lessonGames.ts), played from the
 * homework: it opens `/play/lesson/<lessonId>?game=…&hw=…` and the student's
 * result is posted back. `title` is the lesson's Arabic title. The game names
 * are spelled here, not imported, because this file takes no imports.
 * `exercises` is the Math Corner's «اختبر نفسك» set for a maths lesson: it opens
 * `/curriculum/math/exercises/<lessonId>?hw=…` instead, and reports the same way.
 */
export type HomeworkGameName = 'memory' | 'scramble' | 'spot' | 'exercises';
export const HOMEWORK_GAMES: readonly HomeworkGameName[] = ['memory', 'scramble', 'spot', 'exercises'];
export interface HomeworkGameResource {
  kind: 'game';
  lessonId: string;
  game: HomeworkGameName;
  title: string;
}

export type HomeworkResource = HomeworkLibraryResource | HomeworkMaterialResource | HomeworkGameResource;

/** An attachment's identity in a list — for a Library item, the picker's own "already added" key. */
export function resourceKey(r: HomeworkResource): string {
  if (r.kind === 'game') return `game:${r.lessonId}:${r.game}`;
  return r.kind === 'material' ? `material:${r.materialId}` : `${r.source}:${r.nativeId}`;
}

/** Best round of one game on a homework, as `gameResults` carries it. */
export interface FamilyGameResult {
  /** A result belongs to a (lesson, game) pair: two memory games of different lessons are two attachments. */
  lessonId: string;
  game: HomeworkGameName;
  score: number;
  total: number;
  attempts: number;
}

/** One student's best round, as the teacher's `GET /homework/:id/game-results` lists it. */
export interface TeacherGameResult extends FamilyGameResult {
  studentId: string;
  displayName: string;
  playedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a saved material can be attached: it must be on the server (a save
 * made offline has a device-only `ws_…` id the server has never seen), and not
 * a board, which only reopens in the teacher's whiteboard.
 */
export function isAttachableMaterial(m: { id: string; type: string }): boolean {
  return UUID.test(m.id) && m.type !== 'board';
}

export interface FamilyHomework {
  id: string;
  title: string;
  instructions: string;
  /** YYYY-MM-DD, Asia/Amman. */
  dueDate: string;
  className: string;
  teacherName: string;
  done: boolean;
  state: HomeworkState;
  examTitle: string | null;
  resources: HomeworkResource[];
  /**
   * Whether anyone can tick THIS item off — the server's per-item rule (some
   * roster row of the child in this item's class has a student account). False
   * means «متأخّر» / «لم يُنجز» would be claims the system cannot back, so the
   * item shows its date only. Ticking is per class, so this is per item, not
   * per child. Absent on the wire (an older server) reads as true.
   */
  canTrack: boolean;
  /** Best round per attached game; absent on the wire (an older server) reads as none. */
  gameResults: FamilyGameResult[];
}

export interface ChildHomework {
  key: string;
  displayName: string;
  /**
   * Informational aggregate (any item trackable; with no items, any row has an
   * account). NOT the rule for a given item — use `FamilyHomework.canTrack`.
   * Absent on the wire (an older server) reads as true.
   */
  canTrack: boolean;
  homework: FamilyHomework[];
}

export interface TeacherHomework {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  evaluationId: string | null;
  examTitle: string | null;
  resources: HomeworkResource[];
  doneCount: number;
  studentCount: number;
  /**
   * Students in the class who have an account and so can tick it. `doneCount`
   * can only ever reach this, so it — not `studentCount` — is the denominator.
   */
  trackableCount: number;
}

export interface TeacherHomeworkList {
  studentCount: number;
  trackableCount: number;
  homework: TeacherHomework[];
}

/** `days` is the signed distance from today: negative = late. */
export type DueBadge = { kind: 'overdue' | 'today' | 'tomorrow' | 'later'; days: number };

const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in Amman as YYYY-MM-DD. */
export function ammanToday(now: Date = new Date()): string {
  return new Date(now.getTime() + AMMAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight UTC of a YYYY-MM-DD, or NaN when it is not a real date. */
function ymdToUtc(ymd: string): number {
  const m = YMD.exec(ymd);
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // Date.UTC rolls 2026-02-30 over to 2026-03-02; a round trip catches that.
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : NaN;
}

export function isValidYmd(s: string): boolean {
  return typeof s === 'string' && !Number.isNaN(ymdToUtc(s));
}

/**
 * True for the line a shared homework leaves in the class chat. A chat message
 * carries no link, so the app recognises the line by its opening — keep it in
 * step with `homeworkChatLine` (api-server `familyPushText.ts`).
 */
export function isHomeworkChatLine(body: string): boolean {
  return body.startsWith('📚 واجب جديد:');
}

/**
 * What a teacher typed into the due-date box, laid out as YYYY-MM-DD. Only the
 * digits are kept (Arabic-Indic ones folded), so the dashes are not typed or
 * deleted by hand: «20261019», «2026/10/19» and «٢٠٢٦-١٠-١٩» all come out as
 * «2026-10-19». A dash appears only once a digit follows it, so Backspace can
 * still delete past it.
 */
export function maskYmd(input: string): string {
  // Folded here, not via latinDigits.ts: this file takes no imports.
  const d = input
    .replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) - (c.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)))
    .replace(/\D/g, '')
    .slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

export function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dueBadge(dueDate: string, today: string): DueBadge {
  const days = Math.round((ymdToUtc(dueDate) - ymdToUtc(today)) / DAY_MS);
  if (days < 0) return { kind: 'overdue', days };
  if (days === 0) return { kind: 'today', days };
  if (days === 1) return { kind: 'tomorrow', days };
  return { kind: 'later', days };
}

/** The teacher's quick picks: tomorrow, in two days, in three, in a week. */
export function dueDatePresets(today: string): { days: number; date: string }[] {
  return [1, 2, 3, 7].map(days => ({ days, date: addDays(today, days) }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function normalizeState(state: unknown, done: boolean): HomeworkState {
  if (done) return 'done';
  return state === 'overdue' ? 'overdue' : 'open';
}

/**
 * Takes the `homework` array of `GET /student/homework` (or one child's, from
 * `/parent/homework`). A row that cannot be shown — no id, title or real due
 * date — is dropped rather than rendered half-empty. Never throws.
 */
export function normalizeFamilyHomework(raw: unknown): FamilyHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): FamilyHomework[] => {
    if (!isRecord(r)) return [];
    const id = str(r['id']);
    const title = str(r['title']);
    const dueDate = str(r['dueDate']);
    if (!id || !title || !isValidYmd(dueDate)) return [];
    const done = r['done'] === true;
    const exam = r['exam'];
    const examTitle = isRecord(exam) && typeof exam['title'] === 'string' ? exam['title'] : null;
    return [
      {
        id,
        title,
        instructions: str(r['instructions']),
        dueDate,
        className: str(r['className']),
        teacherName: str(r['teacherName']),
        done,
        // A done row is `done` whatever the server's label says, so the two
        // fields can never disagree on screen.
        state: normalizeState(r['state'], done),
        examTitle,
        resources: normalizeResources(r['resources']),
        canTrack: r['canTrack'] !== false,
        gameResults: normalizeGameResults(r['gameResults']),
      },
    ];
  });
}

const isGameName = (v: unknown): v is HomeworkGameName => HOMEWORK_GAMES.includes(v as HomeworkGameName);

/** A result without a known game and a sane score out of a positive total is dropped. */
function gameResult(r: unknown): FamilyGameResult | null {
  if (!isRecord(r) || !isGameName(r['game']) || !str(r['lessonId'])) return null;
  const score = r['score'];
  const total = r['total'];
  if (typeof score !== 'number' || typeof total !== 'number' || !Number.isFinite(score) || !Number.isFinite(total)) return null;
  if (total <= 0 || score < 0 || score > total) return null;
  return { lessonId: str(r['lessonId']), game: r['game'], score, total, attempts: Math.max(1, count(r['attempts'])) };
}

/** `gameResults` of a family item. Absent (an older server) is none. Never throws. */
export function normalizeGameResults(raw: unknown): FamilyGameResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(r => {
    const g = gameResult(r);
    return g ? [g] : [];
  });
}

/** The `results` array of `GET /homework/:id/game-results`; a row with no student id is dropped. */
export function normalizeTeacherGameResults(raw: unknown): TeacherGameResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): TeacherGameResult[] => {
    const g = gameResult(r);
    if (!g || !isRecord(r) || !str(r['studentId'])) return [];
    return [{ ...g, studentId: str(r['studentId']), displayName: str(r['displayName']), playedAt: str(r['playedAt']) }];
  });
}

/** The result for one attached game of one lesson, if any. */
export function resultForGame(
  results: readonly FamilyGameResult[],
  lessonId: string,
  game: HomeworkGameName,
): FamilyGameResult | null {
  return results.find(r => r.lessonId === lessonId && r.game === game) ?? null;
}

/**
 * «٧ من ٨» (Arabic UI, Arabic-Indic digits) or "7 of 8". Display only — the
 * numbers stay latin everywhere else. Memory sends pairs of pairs (see the lesson
 * game screen), so its label reads «٦ من ٦».
 */
export function gameScoreText(score: number, total: number, isAr: boolean): string {
  if (!isAr) return `${score} of ${total}`;
  const ar = (n: number) => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
  return `${ar(score)} من ${ar(total)}`;
}

/** An item without a source, id and title is dropped; an absent list (an older server) is none. */
export function normalizeResources(raw: unknown): HomeworkResource[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): HomeworkResource[] => {
    if (!isRecord(r)) return [];
    if (r['kind'] === 'game') {
      const lessonId = str(r['lessonId']);
      const title = str(r['title']);
      const game = r['game'];
      return lessonId && title && isGameName(game) ? [{ kind: 'game', lessonId, game, title }] : [];
    }
    if (r['kind'] === 'material') {
      const materialId = str(r['materialId']);
      const title = str(r['title']);
      return materialId && title ? [{ kind: 'material', materialId, title, type: str(r['type']) }] : [];
    }
    const source = str(r['source']);
    const nativeId = str(r['nativeId']);
    const title = str(r['title']);
    if (!source || !nativeId || !title) return [];
    return [
      {
        kind: 'library',
        source,
        nativeId,
        title,
        mediaKind: str(r['mediaKind']),
        url: str(r['url']) || null,
        thumbnailUrl: str(r['thumbnailUrl']) || null,
      },
    ];
  });
}

/**
 * What to send back for an attachment already on a homework (PATCH resends the
 * whole list). The same body the class shelf's POST takes; the server re-checks
 * it and, for a staff upload, re-reads the Library row.
 */
export function resourceBody(r: HomeworkResource): Record<string, string> {
  if (r.kind === 'game') return { kind: 'game', lessonId: r.lessonId, game: r.game, title: r.title };
  // Only the id: the server takes a material's title and type from the teacher's own row.
  if (r.kind === 'material') return { kind: 'material', materialId: r.materialId };
  return {
    kind: 'library',
    source: r.source,
    nativeId: r.nativeId,
    title: r.title,
    mediaKind: r.mediaKind,
    ...(r.url ? { url: r.url } : {}),
    ...(r.thumbnailUrl ? { thumbnailUrl: r.thumbnailUrl } : {}),
  };
}

/** Takes the `homework` array of `GET /classes/:id/homework`. Extra fields are ignored. */
export function normalizeTeacherHomework(raw: unknown): TeacherHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): TeacherHomework[] => {
    if (!isRecord(r)) return [];
    const id = str(r['id']);
    const title = str(r['title']);
    const dueDate = str(r['dueDate']);
    if (!id || !title || !isValidYmd(dueDate)) return [];
    const studentCount = count(r['studentCount']);
    return [
      {
        id,
        title,
        instructions: str(r['instructions']),
        dueDate,
        evaluationId: str(r['evaluationId']) || null,
        examTitle: str(r['examTitle']) || null,
        resources: normalizeResources(r['resources']),
        doneCount: count(r['doneCount']),
        studentCount,
        trackableCount: trackable(r['trackableCount'], studentCount),
      },
    ];
  });
}

/** A server that omits `trackableCount` is read as "everyone can tick" — never as "no one". */
function trackable(raw: unknown, studentCount: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.min(raw, studentCount) : studentCount;
}

/**
 * `doneCount` can exceed `trackableCount`: a completion is kept after the
 * account's roster link is removed, so the numerator still counts it while the
 * denominator no longer does. Shown as it came that reads «5 of 4».
 */
export function clampedDone(done: number, trackable: number): number {
  return Math.max(0, Math.min(done, trackable));
}

/** The whole body of `GET /classes/:id/homework`. Never throws. */
export function normalizeTeacherList(raw: unknown): TeacherHomeworkList {
  const r = isRecord(raw) ? raw : {};
  const studentCount = count(r['studentCount']);
  return {
    studentCount,
    trackableCount: trackable(r['trackableCount'], studentCount),
    homework: normalizeTeacherHomework(r['homework']),
  };
}

/** The `children` array of `GET /parent/homework`. An entry with no string key is dropped. */
export function normalizeChildHomework(raw: unknown): ChildHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c): ChildHomework[] => {
    if (!isRecord(c) || typeof c['key'] !== 'string') return [];
    return [
      {
        key: c['key'],
        displayName: str(c['displayName']),
        canTrack: c['canTrack'] !== false,
        homework: normalizeFamilyHomework(c['homework']),
      },
    ];
  });
}

/**
 * A due date for display: `DD-MM-YYYY` inside a left-to-right isolate
 * (U+2066 … U+2069). Left to the bidi algorithm the digits and hyphens of a
 * date in an Arabic sentence come out in an order nobody chose; the isolate
 * makes it read the same in Arabic and English. An unparseable string is
 * returned as it came. Display only — never feed this back to the server.
 */
export function formatDueDate(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  return `\u2066${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}\u2069`;
}

/**
 * `todo`: overdue first, then by due date ascending. `done`: kept in the order
 * given — the interface carries no completion time to sort by. Pure.
 */
export function splitHomework(items: FamilyHomework[]): { todo: FamilyHomework[]; done: FamilyHomework[] } {
  // Rank by what the row SHOWS: an untracked item is drawn neutral (no «متأخّر»
  // badge), so a server `overdue` on it must not lift it above open items.
  const rank = (h: FamilyHomework) => (h.canTrack && h.state === 'overdue' ? 0 : 1);
  const todo = items
    .filter(h => !h.done)
    .sort((a, b) => rank(a) - rank(b) || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return { todo, done: items.filter(h => h.done) };
}

/**
 * Which explanation the family list owes for rows with no status: `none` when
 * every visible item can be ticked, `all` when none can (nothing is wrong with
 * the child's classes beyond a missing student account), `some` for a mix
 * (e.g. an account in one teacher's class and none in another's). Saying "no
 * student account" of the child in the mixed case would be false.
 */
export function untrackedMode(items: FamilyHomework[]): 'none' | 'some' | 'all' {
  const n = items.filter(h => !h.canTrack).length;
  return n === 0 ? 'none' : n === items.length ? 'all' : 'some';
}

export type HomeworkSection = { key: 'todo' | 'done' | 'all'; items: FamilyHomework[] };

/**
 * What the family list shows. Normally the «المطلوب» / «تم إنجازه» groups. When
 * EVERY item is untracked (`canTrack === false`) nobody can ever tick any of
 * them, so a «المطلوب» heading would present them as actionable: the list is
 * flat instead (`key: 'all'`, soonest due first, no heading). A mix keeps the
 * groups. `anyUntracked` says whether to explain why some rows have no status.
 */
export function homeworkSections(items: FamilyHomework[]): { sections: HomeworkSection[]; anyUntracked: boolean } {
  const anyUntracked = items.some(h => !h.canTrack);
  if (items.length > 0 && items.every(h => !h.canTrack)) {
    const all = [...items].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    return { sections: [{ key: 'all', items: all }], anyUntracked };
  }
  const { todo, done } = splitHomework(items);
  return {
    sections: [{ key: 'todo' as const, items: todo }, { key: 'done' as const, items: done }].filter(g => g.items.length > 0),
    anyUntracked,
  };
}

/**
 * The optimistic update for a tap. Reopening cannot ask the server whether the
 * homework is late, so it recomputes that from the due date and today in Amman.
 */
export function applyDone(items: FamilyHomework[], id: string, done: boolean): FamilyHomework[] {
  const today = ammanToday();
  return items.map(h => {
    if (h.id !== id) return h;
    if (done) return { ...h, done: true, state: 'done' };
    return { ...h, done: false, state: h.dueDate < today ? 'overdue' : 'open' };
  });
}

/**
 * Whether every item that can be ticked is done: the moment School celebrates
 * («أنجزت كل واجباتك»). An item nobody can tick (`canTrack: false`) neither
 * holds it back nor counts toward it, and a list with nothing trackable is
 * never "all done".
 */
export function allTrackedDone(items: FamilyHomework[]): boolean {
  const tracked = items.filter(h => h.canTrack);
  return tracked.length > 0 && tracked.every(h => h.done);
}

export function homeworkDraftError(d: { title: string; dueDate: string }): 'title' | 'dueDate' | null {
  if (d.title.trim() === '') return 'title';
  if (!isValidYmd(d.dueDate)) return 'dueDate';
  return null;
}
