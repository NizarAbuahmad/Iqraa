/**
 * A «which one» item never reaches a worksheet with nothing to pick from.
 *
 * Worksheets file each item as short answer, fill-in or multiple choice at
 * random, and only multiple choice printed the options, so «أيّ وحدة أنسب
 * لقياس طول الكتاب؟» could arrive keyed «مشبك الورق» with no list at all (found
 * building the Grades 1–9 ready-made sheets, 2026-11-20). `formatItem` now keeps
 * a pick's options in every slot. The rule is `picks.ts`; the sweep draws every
 * template in `TOPICS` at every tier and formats it into every typed slot.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';
import { formatConcreteItem, type DiffTier } from '../index.ts';
import { isPick, isUnlistedPick } from '../picks.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('isUnlistedPick', () => {
  it('a pick with its answer off the page', () => {
    assert.equal(isUnlistedPick('أيّ وحدة أنسب لقياس طول الكتاب؟', 'مشبك الورق'), true);
    assert.equal(isUnlistedPick('أي هذه الأشياء يشبه الكرة؟', 'حبة الكرز'), true);
    assert.equal(isUnlistedPick('أيّ الأسئلة الآتية سؤال إحصائي؟', 'كم عمرك؟'), true);
    assert.equal(isUnlistedPick('Which of these is a statistical question?', 'How old are you?'), true);
  });

  it('found by the hand review of the built sheets (2026-11-20)', () => {
    // Two words between «أيّ» and what it points at.
    assert.equal(isUnlistedPick('أيّ البيانات العددية الآتية بيانات منفصلة؟', 'عدد الأهداف في كل مباراة'), true);
    // Groups or boxes the question names but never shows.
    assert.equal(isUnlistedPick('في أيّ مجموعة نضع «برتقالة»؟', 'الفواكه'), true);
    assert.equal(
      isUnlistedPick('رتّبت المعلمة الأشكال في صناديق حسب الشكل واللون. في أيّ صندوق نضع «دائرة زرقاء»؟', 'صندوق «دائرة زرقاء»'),
      true,
    );
  });

  it('a pick that lists its choices, harakat and guillemets aside', () => {
    assert.equal(isUnlistedPick('أي الأعداد الآتية فردي: 88، 26، 81، 54؟', '81'), false);
    assert.equal(isUnlistedPick('أي مقاييس النزعة المركزية أنسب: الوسط الحسابي، أم الوسيط؟', 'الوسيط'), false);
    assert.equal(isUnlistedPick('أيّ هذه الكلمات اسم شكل: «مُثَلَّث»، قلم، باب؟', 'مثلث'), false);
  });

  it('not a pick: a worked question that only mentions «الآتي», «هذه» or «التالي»', () => {
    for (const text of [
      'ما العدد التالي للعدد 49؟',
      'عند سامي هذه الأشكال: مثلث أحمر، مربع أحمر. كم مربعًا أحمر عنده؟',
      'رتّب الأعداد الآتية تنازليًّا: 583، 598، 147',
      'اكتب العدد الآتي بالصيغة القياسية: 7 + 0.4',
      'وُضعت هذه الأشياء معًا في مجموعة واحدة: ممحاة، مسطرة، قلم. على أيّ أساس صُنّفت؟',
      'أي عدد نضيفه إلى 243 لنحصل على 283؟',
      'بين أي عشرتين يقع العدد 37؟',
      'Which number comes after 49?',
    ]) {
      assert.equal(isPick(text), false, text);
    }
  });
});

describe('a pick keeps its options in every worksheet slot', () => {
  it('every template, every tier, short answer / fill-in / word problem', () => {
    const failures = new Map<string, string>();
    let picks = 0;
    for (const topic of TOPICS) {
      for (let i = 0; i < 90; i += 1) {
        let item;
        try {
          item = makeTopicItem(topic, 1, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11));
        } catch {
          continue; // a template that refuses a tier is another test's business
        }
        for (const type of ['short_answer', 'fill_blank', 'word_problem'] as const) {
          for (const lang of ['ar', 'en'] as const) {
            const q = formatConcreteItem(item, lang, type);
            if (!isPick(q.text)) continue;
            picks += 1;
            const shown = isUnlistedPick(q.text, q.answer) ? (q.options ?? []).includes(q.answer) : true;
            if (!shown && !failures.has(topic.id)) failures.set(topic.id, `[${type}/${lang}] ${q.text} → ${q.answer}`);
          }
        }
      }
    }
    assert.ok(picks > 100, `the sweep met only ${picks} picks — is it still drawing?`);
    assert.deepEqual([...failures.entries()], [], 'picks with nothing to pick from');
  });
});
