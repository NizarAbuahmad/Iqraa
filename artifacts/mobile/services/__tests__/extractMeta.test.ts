/**
 * The fence: an unreadable file must not become curriculum content.
 *
 * On mobile there is no OCR and no Word/PowerPoint parser, so for every PDF,
 * every .docx, every .pptx and every image, nothing is read. `extract.ts` used
 * to answer that by writing learning objectives, formulas, definitions, worked
 * examples and classroom activities out of the *filename* — «أن يفهم الطالب
 * المفاهيم الأساسية في …» from a file called `الدائرة.pdf` — and
 * `buildDocumentPromptBlock` put them in the prompt under ordinary headings.
 *
 * The result was labelled `extractQuality: 'filename'`, which is exactly what
 * made it survive: the label was honest and the payload was not, and only the
 * payload reached a model. Same shape as a `verified` flag set from a fallback.
 *
 * These assertions are on the prompt string, not on the meta object, because
 * the prompt string is what actually travels.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDocumentPromptBlock,
  demoExtractFromName,
  sessionDocsExtractQuality,
} from '../documents/extractMeta.ts';
import type { SessionDocument } from '../documents/types';

const asDoc = (name: string, kind: SessionDocument['kind'], plain?: string): SessionDocument => ({
  id: name,
  name,
  kind,
  uri: `file:///${name}`,
  status: 'ready',
  progress: 1,
  extracted: demoExtractFromName(name, kind, plain),
} as SessionDocument);

const UNREADABLE: Array<[string, SessionDocument['kind']]> = [
  ['أوتار الدائرة.pdf', 'pdf'],
  ['خطة الوحدة الثانية.docx', 'docx'],
  ['عرض الاقترانات.pptx', 'pptx'],
  ['صفحة 34.jpg', 'image'],
];

describe('demoExtractFromName invents nothing', () => {
  for (const [name, kind] of UNREADABLE) {
    it(`states no curriculum content for ${kind}`, () => {
      const e = demoExtractFromName(name, kind);
      assert.equal(e.extractQuality, 'filename');
      // Each of these asserts a fact about a lesson. Nothing read the file, so
      // there is no fact to assert.
      assert.deepEqual(e.learningObjectives, [], 'objectives invented from a filename');
      assert.deepEqual(e.formulas, [], 'formulas invented from a filename');
      assert.deepEqual(e.definitions, [], 'definitions invented from a filename');
      assert.deepEqual(e.examples, [], 'examples invented from a filename');
      assert.deepEqual(e.activities, [], 'activities invented from a filename');
    });
  }

  it('keeps what is genuinely known', () => {
    // The filename and the words in it are the teacher's own, about their own
    // file. Dropping those would be a different kind of dishonesty.
    const e = demoExtractFromName('أوتار الدائرة.pdf', 'pdf');
    assert.equal(e.lessonTitle, 'أوتار الدائرة');
    assert.ok(e.keyConcepts.includes('الدائرة'), JSON.stringify(e.keyConcepts));
    assert.match(e.summary ?? '', /لم يُقرأ/);
  });

  it('still reads a file that could be read', () => {
    // The fence must not swallow the .txt path, which is the one real extract.
    const plain = [
      'الدرس الأول: أوتار الدائرة',
      'الوتر قطعة مستقيمة طرفاها على الدائرة.',
      'القطر هو أطول وتر في الدائرة ويمر بمركزها.',
      'مثال: إذا كان طول نصف القطر 5 سم فإن طول القطر 10 سم.',
    ].join('\n');
    const e = demoExtractFromName('الدائرة.txt', 'txt', plain);
    assert.notEqual(e.extractQuality, 'filename');
    assert.ok((e.plainText ?? '').includes('أطول وتر'), 'the real text was dropped');
  });
});

describe('buildDocumentPromptBlock', () => {
  it('tells the model the file was not read', () => {
    const block = buildDocumentPromptBlock([asDoc('أوتار الدائرة.pdf', 'pdf')], 'ar');
    assert.match(block, /لم يُقرأ محتوى هذا الملف/);
    // Not merely a quality grade. A model told only that quality is low writes
    // the lesson anyway; being told what is missing is what stops it.
    assert.match(block, /لا تفترض ما بداخله/);
  });

  it('carries no objectives or examples for an unread file', () => {
    for (const [name, kind] of UNREADABLE) {
      const block = buildDocumentPromptBlock([asDoc(name, kind)], 'ar');
      assert.ok(!/أهداف:/.test(block), `${kind}: objectives reached the prompt`);
      assert.ok(!/أمثلة:/.test(block), `${kind}: examples reached the prompt`);
      // The old scaffold's giveaway sentence.
      assert.ok(!/أن يفهم الطالب/.test(block), `${kind}: an invented objective reached the prompt`);
    }
  });

  it('warns in English too', () => {
    const block = buildDocumentPromptBlock([asDoc('circle chords.pdf', 'pdf')], 'en');
    assert.match(block, /contents were not read/);
    assert.ok(!/Objectives:/.test(block));
  });

  it('still passes on a file it did read', () => {
    const plain = 'القطر هو أطول وتر في الدائرة ويمر بمركزها. مثال محلول: نصف القطر 5 سم.';
    const block = buildDocumentPromptBlock([asDoc('الدائرة.txt', 'txt', plain)], 'ar');
    assert.match(block, /أطول وتر/);
    assert.ok(!/لم يُقرأ محتوى هذا الملف/.test(block));
  });

  it('is empty when there is nothing ready', () => {
    assert.equal(buildDocumentPromptBlock([], 'ar'), '');
  });
});

describe('sessionDocsExtractQuality', () => {
  it('reports the best quality present, not the worst', () => {
    const docs = [asDoc('a.pdf', 'pdf'), asDoc('b.txt', 'txt', 'نص حقيقي طويل بما يكفي ليُعتبر نصًّا مقروءًا فعلًا.')];
    assert.equal(sessionDocsExtractQuality(docs), 'text');
    assert.equal(sessionDocsExtractQuality([asDoc('a.pdf', 'pdf')]), 'filename');
    assert.equal(sessionDocsExtractQuality([]), null);
  });
});
