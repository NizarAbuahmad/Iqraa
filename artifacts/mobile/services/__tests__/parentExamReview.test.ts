/**
 * A parent opens their child's answer review (since 2026-11-25).
 *
 * The server holds the rule (the same `studentReviewReady` as the child's, and one 404
 * for a key that is not the parent's — `answerReview.db.test.ts`). What the app must get
 * right is narrower, and pinned here:
 * - the parent's request goes to `/parent/…` with the child's key, the student's stays on
 *   `/student/…`;
 * - «نتائج أبنائي» passes the child it is showing, so a sibling's paper is never asked for;
 * - the review screen tells the two readers apart (title, «الإجابة المُقدَّمة»);
 * - the teacher's switch says parents see it too, since that is what turning it on now does.
 *
 * The screens import react-native and expo, which `node --test` cannot load, so the
 * screen checks read their source (the pattern parentProjectScreen.test.ts uses).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import translations from '../i18n.ts';
import { examReviewPath } from '../myExams.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, '../..', rel), 'utf8');
const results = read('app/my-exams.tsx');
const review = read('app/exam-review/[id].tsx');
const card = read('components/AnswerReviewCard.tsx');

describe('examReviewPath', () => {
  it("reads a student's own paper on the student route", () => {
    assert.equal(examReviewPath('e1'), '/student/exams/e1/review');
    assert.equal(examReviewPath('e1', null), '/student/exams/e1/review');
    assert.equal(examReviewPath('e1', ''), '/student/exams/e1/review');
  });

  it("reads a child's paper on the parent route, by the child key", () => {
    assert.equal(examReviewPath('e1', 'k1'), '/parent/exams/e1/review?child=k1');
  });

  it('encodes both parts', () => {
    assert.equal(examReviewPath('a/b', 'k&x=1'), '/parent/exams/a%2Fb/review?child=k%26x%3D1');
  });
});

describe('«نتائج أبنائي» opens the child it shows', () => {
  it("passes the group's child key and name to the review", () => {
    assert.match(results, /child=\{isParent && group\.name \? \{ key: group\.key, name: group\.name \} : undefined\}/);
    assert.match(results, /params: child \? \{ id: exam\.evaluationId, child: child\.key, name: child\.name \} : \{ id: exam\.evaluationId \}/);
  });

  it("never offers a parent the button without knowing whose paper it is", () => {
    assert.match(results, /exam\.review && \(!parentView \|\| child\)/);
  });

  it("words the button for a parent", () => {
    // A parent only ever gets the full review, so their label never names the feedback mode.
    assert.match(results, /t\(parentView \? 'reviewOpenBtnChild' : exam\.reviewMode === 'feedback' \? 'feedbackOpenBtn' : 'reviewOpenBtn'\)/);
  });
});

describe('the review screen, read by a parent', () => {
  it('asks for the paper with the child key it was opened with', () => {
    assert.match(review, /getExamReview\(id, child\)/);
    assert.match(review, /useEffect\(load, \[id, child\]\)/);
  });

  it('names the child, and calls the answer the one given, not «yours»', () => {
    assert.match(review, /child \? t\('reviewTitleChild', childName\) : t\(review\?\.mode === 'feedback' \? 'feedbackTitle' : 'reviewTitle'\)/);
    // The cards are the shared AnswerReviewCard (also the hand-in screen's); the screen tells it who is reading.
    assert.match(review, /<AnswerReviewCard key=\{item\.questionId\} item=\{item\} parent=\{Boolean\(child\)\} \/>/);
    assert.match(card, /parent \? 'reviewGivenAnswer' : 'reviewYourAnswer'/);
  });

  it('puts the name after its label, isolated, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const title = translations[lang].reviewTitleChild('سارة');
      assert.ok(title.includes('⁨سارة⁩'), title);
      assert.ok(!title.startsWith('⁨'), 'a name first would set the line direction');
      assert.ok(translations[lang].reviewTitleChild('').length > 0);
    }
  });
});

describe("the teacher's switch says who sees the answers", () => {
  it('names parents in Arabic', () => {
    const ar = translations.ar;
    for (const key of ['showSolutionsBtn', 'hideSolutionsBtn', 'showSolutionsConfirm', 'solutionsShownNote', 'solutionsHiddenNote'] as const) {
      assert.match(ar[key], /وليّ أمره|أولياء أمورهم/, key);
    }
  });

  it('names parents in English', () => {
    const en = translations.en;
    for (const key of ['showSolutionsBtn', 'hideSolutionsBtn', 'showSolutionsConfirm', 'solutionsShownNote', 'solutionsHiddenNote'] as const) {
      assert.match(en[key], /parent/i, key);
    }
  });
});
