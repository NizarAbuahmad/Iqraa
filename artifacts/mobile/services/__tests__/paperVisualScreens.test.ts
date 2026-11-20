import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('physics drawings on screen', () => {
  it('PaperVisual draws only what paperVisualOf shows, through FigureView', () => {
    const src = read('components/ui/PaperVisual.tsx');
    assert.match(src, /paperVisualOf\(question\)/);
    assert.match(src, /<FigureView figure=\{figure\} lang=\{lang\} \/>/);
    assert.ok(!/resolvePhysicsFigure|resolveFigure/.test(src), 'no second gate');
  });
  for (const [file, count] of [['app/ai-tools/quiz.tsx', 1], ['app/ai-tools/worksheet.tsx', 1], ['app/workspace/view.tsx', 2]] as const) {
    it(`${file} renders PaperVisual (${count}×) and reads no visual directly`, () => {
      const src = read(file);
      assert.equal(src.split('<PaperVisual ').length - 1, count);
      assert.ok(!/\.visual\b/.test(src), `${file} reads .visual directly`);
    });
  }
  it('the book-figure hint is not shown for a question with a drawing', () => {
    assert.match(read('app/ai-tools/worksheet.tsx'), /!q\.figure && !paperVisualOf\(q\) && questionRefersToFigure\(q\.text\)/);
  });
  it('the exam path is untouched: QuestionVisual still gates with resolveFigure', () => {
    assert.match(read('components/ui/QuestionVisual.tsx'), /resolveFigure\(body\['visual'\]\)/);
  });
});
