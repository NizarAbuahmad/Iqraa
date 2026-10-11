/**
 * The learner's role (دور المُتعلم) on the Ministry lesson-plan form, for when
 * the plan has none of its own.
 *
 * The form's learner column came out empty whenever the model's
 * `ministryRoles` split was missing — offline/demo mode, a failed generation,
 * and the on-screen plan export, which never asks for one. A teacher got the
 * teacher column filled and half the form blank, on every grade.
 *
 * These lines are generic per stage and per teaching style, not lesson-
 * specific: they say what students do at that point of a lesson taught that
 * way, and name the lesson only where it reads naturally. They are the
 * fallback — a learner role the model wrote for this lesson always wins (see
 * `stagesFromLessonPlan`). Style matters because a collaborative plan must not
 * tell students to work alone, the same self-contradiction
 * `lessonPlanBlueprints.ts` exists to prevent.
 *
 * Pure, no imports: loadable by `node --test`.
 */

export interface LearnerRoleContext {
  /** The language the plan's teacher column is written in. */
  lang: 'ar' | 'en';
  /** `direct` | `inquiry` | `collaborative`; anything else reads as `direct`. */
  style?: string;
  /** The lesson's title, named in the explain stage. */
  topic?: string;
}

type Style = 'direct' | 'inquiry' | 'collaborative';

/** Four stages, in form order: engage · explain · extend · consolidate. */
type Roles = readonly [string, string, string, string];

const AR = (topic: string): Record<Style, Roles> => ({
  direct: [
    'يستجيب الطلبة لسؤال التمهيد، ويستحضرون ما يعرفونه سابقًا، ويشاركون بتوقعاتهم.',
    `يتابع الطلبة شرح المعلم لـ«${topic}»، ويدوّنون الأمثلة المحلولة، ويجيبون عن أسئلة التحقق، ثم يحلّون مع المعلم مثالًا موجّهًا.`,
    'يطبّق الطلبة ما تعلموه في تدريب مستقل بمستوى يناسب كلًّا منهم؛ يستعين المحتاجون بالأمثلة المحلولة، ويتحدّى المتميزون أنفسهم بأسئلة أعمق.',
    'يلخّص الطلبة ما تعلموه بكلماتهم، ويجيبون عن أسئلة التقييم الختامي، ويراجعون أخطاءهم، ويدوّنون الواجب.',
  ],
  inquiry: [
    'يلاحظ الطلبة موقفًا أو مثالًا محيّرًا، ويطرحون أسئلتهم وتوقعاتهم حوله.',
    `يلاحظ الطلبة الأمثلة ويجرّبونها بأنفسهم، ويسجّلون ملاحظاتهم، ويستنتجون الفكرة حول «${topic}» قبل أن يعلنها المعلم.`,
    'يختبر الطلبة استنتاجهم على حالة جديدة، ويفسّرون نتائجهم ويبرّرونها، ويوسّع المتميزون السؤال بأسئلة جديدة.',
    'يراجع الطلبة استنتاجهم النهائي، ويصيغونه بكلماتهم، ويجيبون عن أسئلة التقييم الختامي، ويدوّنون الواجب.',
  ],
  collaborative: [
    'يستجيب الطلبة لسؤال التمهيد بالنقاش مع زميل، ويتشاركون ما يعرفونه سابقًا قبل تكوين المجموعات.',
    `يعمل الطلبة في مجموعات صغيرة على مهمة حول «${topic}»، ويتبادلون الأدوار، ويناقشون الحل معًا، ويعرض ممثل كل مجموعة ما توصلت إليه.`,
    'ينجز كل طالب جزءه من مهمة المجموعة ويشرحه لزملائه، ثم يعمل بمفرده ليتأكد من فهمه الشخصي، ويساعد المتميزون زملاءهم.',
    'تعرض المجموعات نتاجها، ثم يجيب كل طالب عن سؤال ختامي بمفرده، ويراجع خطأه، ويدوّن الواجب.',
  ],
});

const EN = (topic: string): Record<Style, Roles> => ({
  direct: [
    'Students respond to the opening question, recall what they already know, and share their predictions.',
    `Students follow the teacher's explanation of ${topic}, copy the worked examples, answer check-for-understanding questions, then solve a guided example alongside the teacher.`,
    'Students apply what they learned in independent practice pitched at their own level; those who need it use the worked examples, and stronger students take on deeper questions.',
    'Students summarise what they learned in their own words, answer the closing assessment questions, correct their mistakes and note the homework.',
  ],
  inquiry: [
    'Students look at a puzzling situation or example and ask questions and make predictions about it.',
    `Students observe and try the examples themselves, record what they notice, and work out the idea behind ${topic} before the teacher names it.`,
    'Students test their conclusion on a new case, explain and justify their results, and stronger students extend the question with new ones.',
    'Students check their final conclusion, put it into their own words, answer the closing assessment questions and note the homework.',
  ],
  collaborative: [
    'Students respond to the opening question by talking it over with a partner, sharing what they already know before groups form.',
    `Students work in small groups on a task about ${topic}, take turns in their roles, discuss the solution together, and one member of each group presents what it found.`,
    'Each student completes their part of the group task and explains it to their group, then works alone to confirm their own understanding; stronger students help their peers.',
    'Groups present their results, then every student answers a closing question on their own, corrects their mistakes and notes the homework.',
  ],
});

/** The learner's role for each of the form's four stages, in form order. */
export function learnerRoles(ctx: LearnerRoleContext): string[] {
  const style: Style = ctx.style === 'inquiry' || ctx.style === 'collaborative' ? ctx.style : 'direct';
  const topic = ctx.topic?.trim() || (ctx.lang === 'ar' ? 'الدرس' : 'the lesson');
  const table = ctx.lang === 'ar' ? AR(topic) : EN(topic);
  return [...table[style]];
}
