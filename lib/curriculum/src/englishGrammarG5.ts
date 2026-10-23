/**
 * Grade 5 grammar for the English corner: the ten authored hub lessons (spec:
 * docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md), each a unit of hand-written items from
 * `englishGrammarG5Items.ts`. Nothing is pictured. Every unit ships `reviewedBy: null`: offered to nobody until a teacher
 * signs the printed form (`docs/english-grammar-g5-review.html`). `NOT_COVERED_G5` is what the form says is left out.
 *
 * Imports only types from the engine, and the hub (which does not import the engine): `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';
import { G5_ITEM_LESSONS } from './englishGrammarG5Items.ts';
import { hubLessonsForGrade } from './englishHub.ts';

const HUB_ORDER = new Map(hubLessonsForGrade(5).map((l, i) => [l.id, i]));

const UNITS_G5: GrammarUnit[] = G5_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items }) satisfies GrammarUnit);

/** In the book's order, so the sheet reads unit by unit. */
export const GRAMMAR_UNITS_G5: GrammarUnit[] = [...UNITS_G5].sort((a, b) => HUB_ORDER.get(a.lessonId)! - HUB_ORDER.get(b.lessonId)!);

const SHARED = [
  'لا صور ولا «نعم أم لا» في هذا الدرس: الجملة تُحدِّد الصيغة، والأسئلة عن القواعد لا عن المعلومات.',
  '«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها. «اختر الكلمة» و«رتّب الجملة» يقرآن الجملة الصحيحة بعد الإجابة.',
];

const L = (s: string) => `kbl-g5-eng-${s}`;

/** What a Grade 5 lesson does not cover, and why — printed on the teacher's form. One bullet per item, no `"`, `&`, `<` or `>`. */
export const NOT_COVERED_G5: Record<string, string[]> = {
  [L('s1-nccd-u1_l1')]: [...SHARED, 'جمل before وafter وwhen تُحدِّد صيغة الفعل مع he وshe وit (washes) وأن will لا تأتي بعد when، دون سؤال عن ترتيب الأحداث نفسه.'],
  [L('s1-nccd-u2_l1')]: [...SHARED, 'الصفات الشاذة (good وbad) في موضوع واحد صغير، ولا مقارنة بـ as … as.'],
  [L('s1-nccd-u3_l1')]: [...SHARED, 'الخيارات الخاطئة أخطاء في الصيغة (had بعد did، sended)، لا اختيار بين الماضي البسيط والماضي المستمر.'],
  [L('s1-nccd-u4_l1')]: [...SHARED, "will وwon't فقط، دون going to، لأن الاختيار بينها وبين will كثيرًا ما يقبل الإجابتين."],
  [L('s1-nccd-u5_l1')]: [...SHARED, 'who للأشخاص وwhich للأشياء وwhere للأماكن؛ وwho دائمًا فاعلٌ في جملة الصلة، أما who بصفة مفعول (the man who we saw) فغير مختبَر.'],
};
