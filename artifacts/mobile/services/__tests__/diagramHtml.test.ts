import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagramHtml } from '../diagramHtml.ts';
import { diagramGeometry, DIAGRAM_W, DIAGRAM_H } from '../diagramGeometry.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const C = { card: '#FFFFFF', tint: '#E0F0F0', accent: '#1E8E8E', border: '#EFDCD4', text: '#22303C' };

describe('diagramHtml', () => {
  const g = diagramGeometry({ kind: 'cycle', stages: [{ label: 'تبخر' }, { label: 'تكاثف' }, { label: 'هطول <x>' }] }, DIAGRAM_W, DIAGRAM_H, true);
  const html = diagramHtml(g, C, true, esc);
  it('draws every shape and every label as real text', () => {
    assert.equal((html.match(/<rect /g) ?? []).length, 3);
    assert.equal((html.match(/<line /g) ?? []).length, 3);
    assert.equal((html.match(/<polygon /g) ?? []).length, 3);
    for (const w of ['تبخر', 'تكاثف']) assert.ok(html.includes(w));
  });
  it('escapes labels and sets the reading direction on the text', () => {
    assert.ok(html.includes('هطول &lt;x>'));
    assert.ok(!html.includes('<x>'));
    assert.match(html, /direction:rtl/);
  });
  it('uses the theme colours, never a hard-coded one', () => {
    assert.match(html, /stroke="#1E8E8E"/);
    assert.match(html, /fill="#FFFFFF"/);
  });
  it('draws every beat: nothing is held back for a build', () => {
    const tree = diagramGeometry({ kind: 'tree', root: 'جذر', branches: [{ label: 'أ', leaves: ['س'] }, { label: 'ب', leaves: [] }] }, DIAGRAM_W, DIAGRAM_H, true);
    const out = diagramHtml(tree, C, true, esc);
    assert.equal((out.match(/class="deck-diagram-text"/g) ?? []).length, tree.texts.length);
    assert.equal((out.match(/<rect /g) ?? []).length, tree.shapes.filter(s => s.t === 'box').length);
  });
  it('sets left-to-right text when the deck is not Arabic', () => {
    assert.match(diagramHtml(g, C, false, esc), /direction:ltr/);
  });
});
