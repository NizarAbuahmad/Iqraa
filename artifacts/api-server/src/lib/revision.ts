/**
 * The revision clause of a wide-scope lesson plan, activity or classroom deck.
 *
 * A teacher who picks a unit, a semester or the whole book on a teaching tool
 * gets ONE revision session (spec `2026-10-14-wide-scope-teaching-tools-design.md`):
 * it spends the time on the key ideas of each unit and says what it leaves out.
 * The offline twins live in the mobile app — the plan in
 * `services/ai/lessonPlanRevision.ts`, built from `services/revisionScope.ts` —
 * so change one, change the other.
 *
 * What the clause renders is only what the strict cache key already hashes:
 * the lesson table's code and title (`coverageHash`, via `parseCoverage`) and
 * nothing derived from the table's `unitId`, which is deliberately NOT hashed
 * (`generationKey.test.ts`: "a field the prompt never shows (unitId) is not
 * hashed"). The units themselves are named by the scope digest the request
 * carries in `additionalContext` (its «الوحدة:» / "Unit:" headings), which is
 * hashed as `contextHash`. So two requests that share a key share a prompt.
 *
 * '' for anything that is not a valid wide-scope request, which leaves every
 * lesson prompt byte-for-byte as it was. Imports nothing that touches the
 * OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";
import { parseCoverage } from "./coverage.ts";

export type RevisionKind = "plan" | "activity" | "classroom";

/** «درس واحد» / «درسان» / «3 دروس» / «11 درسًا» — `arLessonsPhrase` in the app; the API cannot import it. */
function arLessonCount(n: number): string {
  if (n === 1) return "درس واحد";
  if (n === 2) return "درسان";
  if (n >= 3 && n <= 10) return `${n} دروس`;
  return `${n} درسًا`;
}

function lessonListAr(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  return `\nدروس النطاق (${arLessonCount(c.lessons.length)}) بترتيب الكتاب:\n${c.lessons.map((l) => `- ${l.title}`).join("\n")}`;
}

function lessonListEn(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  return `\nLessons in scope (${c.lessons.length}), in book order:\n${c.lessons.map((l) => `- ${l.title}`).join("\n")}`;
}

const CONTRACT_AR: Record<RevisionKind, string> = {
  plan: `هذه خطة حصة مراجعة واحدة لا خطة درس جديد:
- رتّب "mainActivity" جولةً لكل وحدة، بالشكل الذي يقتضيه أسلوب التدريس المحدد أعلاه (المباشر: مراجعة بمثال محلول لكل وحدة؛ الاستقصائي: سؤال موجّه واحد لكل وحدة؛ التعاوني: بطاقة مجموعة لكل وحدة)، ولا تُسقط وحدة.
- اصرف الوقت على الأفكار الرئيسة لكل وحدة، ولا تحاول تغطية كل درس.
- اذكر في "introduction" النطاق الذي تراجعه الحصة، وما الذي لن تتّسع له، بأسماء الدروس.
- اجعل "objectives" من نتاجات الوحدات المذكورة في النطاق، لا أهدافًا عامة.
- حافظ على بنية أسلوب التدريس كما وردت أعلاه، وعلى صيغة المتكلم المستقبل للمعلم كما وردت أدناه.`,
  activity: `هذا النشاط لحصة مراجعة تغطي وحدة أو أكثر، لا درسًا واحدًا:
- استمدّ محتواه من دروس الوحدات المذكورة، وأعطِ كل وحدة نصيبًا منه (فإن كانت وحدة واحدة فوزّعه على دروسها)، ولا تحصره في درس واحد.
- حافظ على بنية هذا النوع من الأنشطة كما وردت أعلاه؛ تتغيّر المادة لا البنية.
- حيث تذكر البنية «صفحة الكتاب»، فالمقصود صفحات الكتاب الخاصة بكل وحدة من الوحدات المذكورة.`,
  classroom: `هذا النشاط الصفي لحصة مراجعة تغطي وحدة أو أكثر، لا درسًا واحدًا:
- وزّع بطاقاته أو أسئلته أو تحدياته على الوحدات المذكورة، وأعطِ كل وحدة نصيبًا منها (فإن كانت وحدة واحدة فوزّعها على دروسها)، ولا تحصرها في درس واحد.
- حافظ على بنية النشاط وشكل JSON المطلوب أعلاه كما هما.`,
};

const CONTRACT_EN: Record<RevisionKind, string> = {
  plan: `This is ONE revision session, not a plan for a new lesson:
- Arrange "mainActivity" as one round per unit, in the form the teaching style above requires (direct: a worked review per unit; inquiry: one guiding question per unit; collaborative: one group card per unit), and leave no unit out.
- Spend the time on each unit's key ideas; do not try to cover every lesson.
- State in "introduction" the scope the session reviews and, by lesson name, what it cannot fit.
- Draw "objectives" from the outcomes of the units in scope, not generic aims.
- Keep the teaching-style structure required above.`,
  activity: `This activity is for a revision session over one or more units, not one lesson:
- Draw its content from the lessons of the units in scope, give each unit a share (for a single unit, spread it over that unit's lessons), and do not confine it to one lesson.
- Keep this format's structure as required above; the material changes, not the structure.
- Where the structure mentions "the textbook page", read it as each unit's own pages in the book.`,
  classroom: `This classroom activity is for a revision session over one or more units, not one lesson:
- Spread its cards, questions or challenges over the units in scope, give each unit a share (for a single unit, spread them over that unit's lessons), and do not confine them to one lesson.
- Keep the activity's structure and the required JSON shape above unchanged.`,
};

export function revisionClauseAr(b: Record<string, unknown>, kind: RevisionKind): string {
  if (!parseWideScope(b.scope)) return "";
  return `\nالنطاق أوسع من درس واحد: الوحدات هي عناوين «الوحدة:» في وصف النطاق أعلاه.${lessonListAr(b)}\n${CONTRACT_AR[kind]}`;
}

export function revisionClauseEn(b: Record<string, unknown>, kind: RevisionKind): string {
  if (!parseWideScope(b.scope)) return "";
  return `\nThe scope is wider than one lesson: the units are the "Unit:" headings in the scope description above.${lessonListEn(b)}\n${CONTRACT_EN[kind]}`;
}
