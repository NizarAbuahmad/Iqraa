/**
 * Grade 8 grammar for the English corner: the authored Semester 1 lessons (spec:
 * docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md), each a unit of hand-written items from
 * `englishGrammarG8Items.ts`. Nothing is pictured. Every unit ships `reviewedBy: null`: offered to nobody until a teacher
 * signs the printed form (`docs/english-grammar-g8-review.html`). `NOT_COVERED_G8` is what the form says is left out.
 *
 * Imports only types from the engine, and the hub (which does not import the engine): `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';
import { G8_ITEM_LESSONS } from './englishGrammarG8Items.ts';
import { hubLessonsForGrade } from './englishHub.ts';

const HUB_ORDER = new Map(hubLessonsForGrade(8).map((l, i) => [l.id, i]));

const UNITS_G8: GrammarUnit[] = G8_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items }) satisfies GrammarUnit);

/** In the book's order, so the sheet reads unit by unit. */
export const GRAMMAR_UNITS_G8: GrammarUnit[] = [...UNITS_G8].sort((a, b) => HUB_ORDER.get(a.lessonId)! - HUB_ORDER.get(b.lessonId)!);

const SHARED = [
  'لا صور ولا «نعم أم لا» في هذا الدرس: الجملة تُحدِّد الصيغة، والأسئلة عن القواعد لا عن المعلومات.',
  '«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها. «اختر الكلمة» و«رتّب الجملة» يقرآن الجملة الصحيحة بعد الإجابة.',
];

const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;

/** What a Grade 8 lesson does not cover, and why — printed on the teacher's form. One bullet per item, no `"`, `&`, `<` or `>`. */
export const NOT_COVERED_G8: Record<string, string[]> = {
  [L('u1_l1')]: [...SHARED, 'المضارع البسيط للروتين اليومي: -s أو -es مع he و she و it، والنفي بـ doesn\'t أو don\'t مع المصدر؛ الخيارات الخاطئة كلها في الشكل. المضارع المستمر غير مشمول هنا لأنه موضوع الوحدة الرابعة.'],
  [L('u1_l3')]: [...SHARED, 'أسئلة do و does وكلمات الاستفهام وموضع ظرف التكرار (she is always late لا she always is late)؛ الخيارات الخاطئة كلها في الشكل أو الترتيب. وكلمة sometimes غير مشمولة لأنها تقبل أكثر من موضع في الجملة.'],
  [L('u2_l1')]: [...SHARED, 'there is مع المفرد وغير المعدود و there are مع الجمع، و some في الإثبات و any في النفي والسؤال. جملة مثل Would you like some tea? غير مشمولة لأن some تأتي فيها في سؤال.'],
  [L('u2_l3')]: [...SHARED, 'can للقدرة والمساعدة في أعمال المنزل: الفعل بعد can بلا to وبلا -s، والسؤال Can you؟. في صفوف can و can\'t الخيار الخاطئ سليم لغويًا لكن جملة بعده تبدأ بـ so أو but تستبعده، وهي أحكام يراجعها المعلم.'],
  [L('u3_l1')]: [...SHARED, 'المعدود (an apple، three eggs) وغير المعدود (some rice، water) ولا جمع لغير المعدود في الجمل. لا تُستخدم أسماء لها جمع مقبول مثل sugar أو fruit أو paper.'],
};
