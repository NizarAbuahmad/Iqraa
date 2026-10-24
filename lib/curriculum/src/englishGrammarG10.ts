/**
 * Grade 10 grammar for the English corner: the authored Semester 1 lessons (spec:
 * docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md), each a unit of hand-written items from
 * `englishGrammarG10Items.ts`. Nothing is pictured. Articles (u1_l5) has no vocabulary rows and is a grammar-only hub
 * lesson (`GRAMMAR_ONLY_LESSONS`). Every unit ships `reviewedBy: null`: offered to nobody until a teacher signs the
 * printed form (`docs/english-grammar-g10-review.html`). `NOT_COVERED_G10` is what the form says is left out.
 *
 * Imports only types from the engine, and the hub (which does not import the engine): `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';
import { G10_ITEM_LESSONS } from './englishGrammarG10Items.ts';
import { hubLessonsForGrade } from './englishHub.ts';

const HUB_ORDER = new Map(hubLessonsForGrade(10).map((l, i) => [l.id, i]));

const UNITS_G10: GrammarUnit[] = G10_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items }) satisfies GrammarUnit);

/** In the book's order, so the sheet reads unit by unit. */
export const GRAMMAR_UNITS_G10: GrammarUnit[] = [...UNITS_G10].sort((a, b) => HUB_ORDER.get(a.lessonId)! - HUB_ORDER.get(b.lessonId)!);

const SHARED = [
  'لا صور ولا «نعم أم لا» في هذا الدرس: الجملة تُحدِّد الصيغة، والأسئلة عن القواعد لا عن المعلومات.',
  '«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها. «اختر الكلمة» و«رتّب الجملة» يقرآن الجملة الصحيحة بعد الإجابة.',
];

const L = (s: string) => `kbl-eng-s1-nccd-${s}`;

/** What a Grade 10 lesson does not cover, and why — printed on the teacher's form. One bullet per item, no `"`, `&`, `<` or `>`. */
export const NOT_COVERED_G10: Record<string, string[]> = {
  [L('u1_l1')]: [...SHARED, 'جمل المضارع البسيط والمستمر تُحدِّد الصيغة بكلمة في الجملة، مثل usually أو Look!، والخيار الآخر يُسمّى «معنى» لا «خطأ». كلمات مثل this week أو always غير مشمولة لأنها تقبل الصيغتين.'],
  [L('u1_l5')]: [...SHARED, 'هذا الدرس بلا أنشطة كلمات أو قراءة لأنه بلا مفردات؛ لن يظهر للطلاب إلا بعد توقيعكم. واختيار a أو the يقبل أحيانًا الصيغتين في سياق أوسع، فراجعوا كل جملة.'],
  [L('u2_l1')]: [...SHARED, 'الحاضر التام البسيط (have written) مقابل المستمر (have been writing): تُحدِّده كلمة العدد أو المدة في الجملة؛ وجمل الصيغة (has been work) أخطاء في الشكل فقط.'],
  [L('u2_l4')]: [...SHARED, 'الفعل وما يتبعه: -ing أو to، وفي تغيّر المعنى (stop doing / stop to do) تُحدِّد بقية الجملة المعنى.'],
  [L('u3_l1')]: [...SHARED, 'الماضي البسيط والمستمر والتام: الحدث القصير الذي يقطع فعلًا أطول (when he fell) يُحدِّد المستمر، والفعل اللحظي بعد While … was skiing يبقى ماضيًا بسيطًا؛ ولا تُحدِّد while وحدها الصيغة لأن While we ate جملة سليمة. و by the time تُحدِّد التام، والخيارات الخاطئة في الشكل (had train) أخطاء صيغة.'],
  [L('u3_l4')]: [...SHARED, 'used to للحالات (have, be, live) و would للتكرار مع كلمة وقت، وفي صفوف would الخيار الخاطئ هو will لأن used to تصلح أيضًا. didn\'t use to هي صيغة الكتاب، و didn\'t used to شائعة في الكتابة غير الرسمية ويقبلها بعض المعلمين، فراجعوا الجملة.'],
  [L('u3_l5')]: [...SHARED, 'ترتيب الكلمات في السؤال غير المباشر (where it is لا where is it)، واستعمال if أو whether لسؤال نعم أو لا؛ الخيارات الخاطئة كلها في ترتيب الكلمات.'],
  [L('u4_l1')]: [...SHARED, 'mustn\'t مقابل don\'t have to تُحدِّدها جملة سبب أو جملة ثانية، وكذلك could أو was able to مقابل can مع كلمة ماضٍ محدَّد، و will be able to مع كلمة مستقبل، ولا مقابلة بين could و was able to لأن كلتيهما تصلح غالبًا؛ أما should أو ought to فغير مشمولتين لأن لكل منهما أكثر من إجابة مقبولة.'],
  [L('u4_l4')]: [...SHARED, 'الجملة الاستدراكية بفاصلتين لا تقبل that، والجملة المحدِّدة تقبل who أو that للأشخاص؛ لا جملة تعتمد على حذف الضمير الموصول.'],
  [L('u5_l1')]: [...SHARED, 'will للقرار اللحظي، و going to لدليل ظاهر؛ والخيار الخاطئ في هذين الموضوعين هو المضارع البسيط (I answer it) لا الصيغة الأخرى، لأن الخطة العامة تقبل will و going to كلتيهما. وموضوع الموعد والجدول يختبر شكل الجملة فقط لأن كل صيغة مستقبل تصلح مع وقت محدد.'],
  [L('u5_l3')]: [...SHARED, 'المستقبل المستمر (will be flying) مع وقت محدد والتام (will have finished) مع by؛ والخيارات الخاطئة الأخرى في الشكل.'],
};
