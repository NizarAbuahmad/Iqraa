/**
 * The lesson infographic: one card summarising a lesson for students.
 *
 * Live generation comes from `POST /generate/infographic`; this module holds
 * the shape both paths return, the offline builder (demo mode, and the
 * fallback when the API fails), and the plain-text form that copy and export
 * hand over. Pure TypeScript (type-only imports), so `node --test` can run it.
 */
import type { KBLesson } from '../knowledgeBase.ts';

export interface InfographicOutput {
  title: string;
  subtitle?: string;
  keyFacts: { label: string; value: string }[];
  sections: { heading: string; icon: string; points: string[] }[];
  takeaway: string;
  variantId?: string;
  servedReason?: 'quota' | 'budget';
}

/**
 * The icons a section may use. Mirrors `INFOGRAPHIC_ICONS` in
 * artifacts/api-server/src/lib/prompts.ts, which tells the model to pick
 * from these; anything else it returns is swapped for the first one.
 */
export const INFOGRAPHIC_ICONS = [
  'bulb-outline', 'book-outline', 'calculator-outline', 'flask-outline',
  'globe-outline', 'leaf-outline', 'time-outline', 'list-outline',
  'git-compare-outline', 'alert-circle-outline', 'checkmark-circle-outline',
  'star-outline', 'people-outline', 'stats-chart-outline', 'shapes-outline',
  'water-outline', 'planet-outline', 'heart-outline', 'construct-outline',
  'chatbubbles-outline',
] as const;

export type InfographicIcon = typeof INFOGRAPHIC_ICONS[number];

export function safeIcon(name: string | undefined): InfographicIcon {
  return (INFOGRAPHIC_ICONS as readonly string[]).includes(name ?? '')
    ? (name as InfographicIcon)
    : INFOGRAPHIC_ICONS[0];
}

/** A chat message asking for an infographic. */
export function isInfographicAsk(query: string): boolean {
  return /[اإ]نفو[جغك]راف|infographic|ملخص\s*بصري|visual\s*summary/i.test(query);
}

/** Cut at a word boundary so a point never ends mid-word. */
function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/** First sentence of a summary — the takeaway should be one line. */
function firstSentence(s: string): string {
  return s.split(/(?<=[.!؟?])\s+/)[0] ?? s;
}

/**
 * Offline infographic, built from the curriculum lesson itself.
 *
 * Every line comes from the lesson record — its terms, concepts, rules,
 * examples and outcomes — so demo mode shows the real lesson in infographic
 * form rather than template filler. With no lesson it says so and points at
 * the lesson picker instead of inventing content.
 */
export function buildInfographicFromLesson(
  topic: string,
  lesson: KBLesson | null,
  lang: 'ar' | 'en',
): InfographicOutput {
  const isAr = lang === 'ar';
  if (!lesson) {
    return {
      title: topic,
      keyFacts: [{ label: isAr ? 'الموضوع' : 'Topic', value: topic }],
      sections: [{
        heading: isAr ? 'ابدأ من درس' : 'Start from a lesson',
        icon: 'book-outline',
        points: [isAr
          ? 'اختر الدرس من «تغيير الدرس» لأبني الإنفوجرافيك من كتاب المنهاج.'
          : 'Pick the lesson with “Change lesson” and I will build it from the textbook.'],
      }],
      takeaway: topic,
    };
  }

  const concepts = isAr ? lesson.keyConceptsAr : lesson.keyConceptsEn;
  const rules = (isAr ? lesson.rulesAr : lesson.rulesEn) ?? [];
  const examples = (isAr ? lesson.examplesAr : lesson.examplesEn) ?? [];
  const summary = isAr ? lesson.summaryAr : lesson.summaryEn;

  const keyFacts = lesson.keyTerms.slice(0, 4).map(k => ({
    label: clip(isAr ? k.ar : k.en, 30),
    value: clip(isAr ? k.definitionAr : k.definitionEn, 80),
  }));
  // Most lessons (1,833 of 3,224, measured 2026-09-25) have neither a
  // glossary nor concepts — only outcomes and a summary. The fact row falls
  // back through concepts, then outcomes, then the summary's own phrases.
  const fallback: Array<[string[], string, string]> = [
    [concepts, 'فكرة', 'Idea'],
    [lesson.objectives, 'هدف', 'Goal'],
    [summary.split(/[.،؛;]\s*/).filter(p => p.trim().length > 12), 'نقطة', 'Point'],
  ];
  let factsFromObjectives = false;
  for (const [list, ar, en] of fallback) {
    if (keyFacts.length > 0) break;
    list.slice(0, 3).forEach((c, i) => {
      // Outcomes read «التذكّر السمعيّ: ذكر تفصيلات…» — the part before the
      // colon is the skill's own name and makes a better label than «هدف 1».
      const named = c.match(/^([^:：]{2,30})[:：]\s*(.+)$/s);
      keyFacts.push({
        label: named ? named[1]!.trim() : (isAr ? `${ar} ${i + 1}` : `${en} ${i + 1}`),
        value: clip(named ? named[2]! : c, 80),
      });
    });
    factsFromObjectives = list === lesson.objectives && keyFacts.length > 0;
  }
  // For those lessons the summary is the outcomes joined together; reusing it
  // for the subtitle, a section and the takeaway said one thing four times.
  const summaryIsOutcomes = lesson.objectives.length > 0
    && summary.startsWith(lesson.objectives[0]!.slice(0, 20));

  const points = (list: string[], n: number) => list.slice(0, n).map(p => clip(p, 110)).filter(Boolean);
  const sections = [
    { heading: isAr ? 'المفاهيم الأساسية' : 'Key concepts', icon: 'bulb-outline', points: points(concepts, 4) },
    { heading: isAr ? 'القواعد والقوانين' : 'Rules and formulas', icon: 'calculator-outline', points: points(rules, 4) },
    { heading: isAr ? 'أمثلة' : 'Examples', icon: 'star-outline', points: points(examples, 3) },
    // Not again if the fact row is already the outcomes.
    { heading: isAr ? 'ماذا سأتعلّم' : 'What I will learn', icon: 'checkmark-circle-outline', points: factsFromObjectives ? [] : points(lesson.objectives, 3) },
  ].filter(s => s.points.length > 0);

  const title = isAr ? lesson.titleAr : lesson.titleEn;
  const fallbackSection = summaryIsOutcomes && factsFromObjectives
    ? { heading: isAr ? 'مهارات الدرس' : 'Skills in this lesson', icon: 'checkmark-circle-outline', points: keyFacts.map(f => f.label) }
    : { heading: isAr ? 'الدرس' : 'The lesson', icon: 'book-outline', points: [clip(summary || topic, 110)] };
  return {
    title,
    subtitle: summary && !summaryIsOutcomes ? clip(summary, 120) : undefined,
    keyFacts,
    sections: sections.length > 0 ? sections : [fallbackSection],
    takeaway: summaryIsOutcomes
      ? (isAr ? `محور الدرس: ${title}` : `Lesson focus: ${title}`)
      : clip(firstSentence(summary || topic), 160),
  };
}

/** The infographic as text — what copy and export hand over. */
export function formatInfographicText(out: InfographicOutput, isAr: boolean): string {
  const lines = [`**${out.title}**`];
  if (out.subtitle) lines.push(out.subtitle);
  lines.push('');
  for (const f of out.keyFacts) lines.push(`• **${f.label}:** ${f.value}`);
  for (const s of out.sections) {
    lines.push('', `**${s.heading}**`, ...s.points.map(p => `• ${p}`));
  }
  lines.push('', `${isAr ? '💡 الخلاصة:' : '💡 Takeaway:'} ${out.takeaway}`);
  return lines.join('\n');
}
