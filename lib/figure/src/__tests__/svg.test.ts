import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureSvg } from '../svg.ts';
import { resolveFigure } from '../gate.ts';

describe('figureSvg', () => {
  it('draws a graph: a curve, a point, its label', () => {
    const svg = figureSvg(resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }], x: [-3, 3], points: [{ at: 2, label: 'A' }] })!);
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
    assert.equal((svg.match(/<polyline /g) ?? []).length, 1);
    assert.equal((svg.match(/<circle /g) ?? []).length, 1);
    assert.ok(svg.includes('>f<') && svg.includes('>A<'));
  });
  it('draws vectors: a shaft and a head each, dashes for components', () => {
    const svg = figureSvg(resolveFigure({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }], components: true })!);
    assert.equal((svg.match(/<polygon /g) ?? []).length, 1);
    assert.ok(svg.includes('stroke-dasharray'));
  });
  it('escapes text and names the axes for the language', () => {
    const f = resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x' }], x: [-2, 2] })!;
    assert.ok(figureSvg(f, { lang: 'ar' }).includes('>س<'));
    assert.ok(figureSvg(f, { lang: 'en' }).includes('>x<'));
    assert.ok(!figureSvg(f).includes('<script'));
  });
  it('clips everything to the box, since curves are laid out far outside it', () => {
    const svg = figureSvg(resolveFigure({ kind: 'function-graph', functions: [{ expr: '1/x' }], x: [-2, 2] })!, { width: 300, height: 200 });
    assert.ok(svg.includes('overflow="hidden"'), 'root svg clips');
    const id = /<clipPath id="([^"]+)"><rect width="300" height="200"\/><\/clipPath>/.exec(svg)?.[1];
    assert.ok(id, 'clipPath over the box');
    assert.ok(svg.includes(`clip-path="url(#${id})"`), 'drawing is wrapped in the clip');
  });
});
