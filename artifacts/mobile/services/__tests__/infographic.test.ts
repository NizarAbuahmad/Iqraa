/**
 * The lesson infographic: detection, the offline builder, and the text form.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/infographic.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInfographicFromLesson,
  formatInfographicText,
  INFOGRAPHIC_ICONS,
  isInfographicAsk,
  safeIcon,
} from '../ai/infographic.ts';
import { topicFromQuery } from '../ai/artifactTopic.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';

describe('isInfographicAsk', () => {
  for (const q of ['انفوجرافيك عن الدرس', 'إنفوجرافيك', 'اعمل انفوغرافيك للاقترانات', 'make an infographic', 'ملخص بصري للدرس']) {
    it(`claims «${q}»`, () => assert.equal(isInfographicAsk(q), true));
  }
  for (const q of ['اشرح الاقترانات', 'أنشئ ورقة عمل', 'عرض شرائح']) {
    it(`leaves «${q}» alone`, () => assert.equal(isInfographicAsk(q), false));
  }
});

describe('topicFromQuery strips the infographic ask', () => {
  it('«اعمل انفوجرافيك عن الاقترانات» → «الاقترانات»', () => {
    assert.equal(topicFromQuery('اعمل انفوجرافيك عن الاقترانات'), 'الاقترانات');
  });
  it('a bare ask leaves nothing', () => {
    assert.equal(topicFromQuery('إنفوجرافيك'), '');
  });
});

describe('buildInfographicFromLesson', () => {
  const required = (o: ReturnType<typeof buildInfographicFromLesson>) => {
    assert.ok(o.title.trim(), 'title');
    assert.ok(o.keyFacts.length > 0, 'keyFacts');
    assert.ok(o.sections.length > 0 && o.sections.length <= 5, 'sections');
    assert.ok(o.sections.every(s => s.points.length > 0), 'every section has points');
    assert.ok(o.takeaway.trim(), 'takeaway');
    for (const s of o.sections) assert.ok((INFOGRAPHIC_ICONS as readonly string[]).includes(s.icon), s.icon);
  };

  // A maths lesson and an Arabic-language lesson — different record shapes.
  const math = KB_LESSONS.find(l => l.id.includes('math') && l.keyTerms.length > 0);
  const arabic = KB_LESSONS.find(l => /arabic|arab/.test(l.id));

  it('fills every field the card draws, for a maths lesson', () => {
    assert.ok(math, 'a maths lesson with key terms exists');
    required(buildInfographicFromLesson(math!.titleAr, math!, 'ar'));
  });

  it('and for an Arabic-language lesson', () => {
    assert.ok(arabic, 'an Arabic-language lesson exists');
    required(buildInfographicFromLesson(arabic!.titleAr, arabic!, 'ar'));
  });

  it('says to pick a lesson rather than inventing one', () => {
    const o = buildInfographicFromLesson('البراكين', null, 'ar');
    required(o);
    assert.match(o.sections[0]!.points[0]!, /تغيير الدرس/);
  });
});

describe('safeIcon', () => {
  it('keeps a listed icon and replaces an invented one', () => {
    assert.equal(safeIcon('flask-outline'), 'flask-outline');
    assert.equal(safeIcon('rocket-launch-3d'), INFOGRAPHIC_ICONS[0]);
    assert.equal(safeIcon(undefined), INFOGRAPHIC_ICONS[0]);
  });
});

describe('formatInfographicText', () => {
  it('carries every fact, section and the takeaway', () => {
    const text = formatInfographicText({
      title: 'الاقترانات',
      keyFacts: [{ label: 'المجال', value: 'قيم x' }],
      sections: [{ heading: 'التعريف', icon: 'bulb-outline', points: ['نقطة أولى'] }],
      takeaway: 'لكل مدخل مخرج واحد',
    }, true);
    for (const s of ['الاقترانات', 'المجال', 'قيم x', 'التعريف', 'نقطة أولى', 'لكل مدخل مخرج واحد']) {
      assert.ok(text.includes(s), s);
    }
  });
});
