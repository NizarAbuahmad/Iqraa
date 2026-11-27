/**
 * The topic summary under a released result (since 2026-11-27): the card shows the
 * server's names in the reader's language, nothing from an older server, and no numbers.
 * The card imports react-native, so its wiring is checked by reading its source.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import translations from '../i18n.ts';
import { resultTopicLines } from '../resultTopics.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const card = readFileSync(path.resolve(here, '../../components/StudentResultCard.tsx'), 'utf8');

const topics = {
  strong: [{ objectiveId: 'a', title: 'Solve linear systems', titleAr: 'يحل نظامًا من معادلتين' }],
  weak: [{ objectiveId: 'b', title: '', titleAr: 'يجد ميل مستقيم' }],
};

describe('resultTopicLines', () => {
  it("names each topic in the reader's language, falling back to the other", () => {
    assert.deepEqual(resultTopicLines(topics, 'ar'), { strong: ['يحل نظامًا من معادلتين'], weak: ['يجد ميل مستقيم'] });
    assert.deepEqual(resultTopicLines(topics, 'en'), { strong: ['Solve linear systems'], weak: ['يجد ميل مستقيم'] });
  });

  it('shows nothing for an older server, or a malformed list', () => {
    assert.deepEqual(resultTopicLines(undefined, 'ar'), { strong: [], weak: [] });
    assert.deepEqual(resultTopicLines({ strong: 'x' as never }, 'ar'), { strong: [], weak: [] });
    assert.deepEqual(resultTopicLines({ strong: [{ objectiveId: 'c', title: ' ', titleAr: '' }] }, 'ar'), { strong: [], weak: [] });
  });
});

describe('the result card', () => {
  it('lists the two kinds only when there is something to list', () => {
    assert.match(card, /const topics = resultTopicLines\(result\.topics, lang\)/);
    assert.match(card, /topics\.strong\.length > 0 \|\| topics\.weak\.length > 0 \?/);
    assert.match(card, /topicList\('resultTopicsStrong', topics\.strong,/);
    assert.match(card, /topicList\('resultTopicsWeak', topics\.weak,/);
  });

  it("never draws the needs-work list in amber, which means «now»", () => {
    assert.ok(!/topicList\('resultTopicsWeak'[^\n]*palette\.(live|warning)/.test(card));
  });

  it('speaks to neither the student nor the parent, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const key of ['resultTopicsStrong', 'resultTopicsWeak'] as const) {
        const text = translations[lang][key];
        assert.ok(text.length > 0);
        assert.ok(!/\b(you|your)\b/i.test(text) && !/(أتقنت|تحتاج|ك\b)/.test(text), `${lang}.${key}: ${text}`);
      }
    }
  });
});
