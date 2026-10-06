/**
 * A worksheet exported from موادي or from the chat. Neither screen has the
 * worksheet screen's answers toggle, so both asked for the key unconditionally
 * or never; `worksheetExports` takes the copy the teacher picked in the export
 * menu. A virtual-lab sheet's key must not reach students by default.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as docx from 'docx';

import { worksheetExports } from '../worksheetExport.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';
import { documentXmlOf } from './docxXml.ts';

const ws = {
  title: 't',
  instructions: 'أجب',
  sections: [{ type: 'short_answer', title: 'ق', questions: [{ text: 'س؟', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'جواب سري' }],
} as unknown as WorksheetOutput;
const meta = { subject: 'الكيمياء', grade: 'الصف العاشر' };

describe('worksheetExports', () => {
  for (const [copy, keyed] of [['student', false], ['teacher', true]] as const) {
    it(`${copy} copy: the key is ${keyed ? 'in' : 'out of'} every format`, async () => {
      const out = worksheetExports(ws, 'ورقة', meta, true, copy);
      const word = documentXmlOf(await docx.Packer.toBuffer(out.word(docx)));
      for (const [format, body] of Object.entries({ text: out.text, html: out.html, word })) {
        assert.equal(body.includes('جواب سري'), keyed, `${format} ${copy}`);
      }
    });
  }
});
