/**
 * What this guards: an Arabic Word export reads right to left. Every paragraph
 * carries `<w:bidi/>` and every run `<w:rtl/>` (alignment alone left Arabic
 * punctuation, digits and bullets laid out left-to-right), nothing sets an
 * explicit `<w:jc>` (in a bidi paragraph `left`/`right` mean start/end, so
 * `RIGHT` would put the text on the LEFT), and an English export is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import * as docx from 'docx';

import { buildWordDocument } from '../docxBuild.ts';

const text = [
  'خطة درس: الأعداد (10)',
  '═══════════════',
  '',
  'الأهداف',
  '───────',
  '• يحل المسائل',
  'ملاحظات المعلم: راجع Unit 3',
].join('\n');

/** word/document.xml out of a .docx — read through the zip's central directory. */
async function documentXml(t: string, isAr: boolean): Promise<string> {
  const buf = await docx.Packer.toBuffer(buildWordDocument(t, isAr, docx));
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(p + 10);
  p = buf.readUInt32LE(p + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === 'word/document.xml') {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  throw new Error('no word/document.xml');
}

const count = (xml: string, re: RegExp) => (xml.match(re) ?? []).length;

describe('buildWordDocument', () => {
  it('makes every Arabic paragraph and run right-to-left', async () => {
    const xml = await documentXml(text, true);
    const paragraphs = count(xml, /<w:p>|<w:p /g);
    assert.equal(paragraphs, 7);
    assert.equal(count(xml, /<w:bidi\/>/g), paragraphs);
    // Every line with text has a run; the blank and rule lines are runs too.
    assert.equal(count(xml, /<w:rtl\/>/g), count(xml, /<w:r>/g) - count(xml, /<w:r><w:br\/>/g));
    assert.ok(xml.includes('الأعداد (10)'));
  });

  it('sets no explicit alignment, which would flip inside a bidi paragraph', async () => {
    const xml = await documentXml(text, true);
    assert.equal(count(xml, /<w:jc /g), 0);
  });

  it('leaves an English export left-to-right', async () => {
    const xml = await documentXml('Lesson plan\n• Solve problems', false);
    assert.equal(count(xml, /<w:bidi\/>/g), 0);
    assert.equal(count(xml, /<w:rtl\/>/g), 0);
    assert.ok(xml.includes('Solve problems'));
  });
});
