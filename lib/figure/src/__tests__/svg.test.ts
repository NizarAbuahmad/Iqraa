import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureSvg } from '../svg.ts';
import { resolveFigure } from '../gate.ts';
import type { SceneFigure } from '../sceneTypes.ts';

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

describe('figureSvg: scenes', () => {
  const proj: SceneFigure = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
  it('draws a projectile: the path, an arrow head, and its labels', () => {
    const svg = figureSvg(proj);
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
    assert.ok((svg.match(/<polyline /g) ?? []).length >= 1);
    assert.ok((svg.match(/<polygon /g) ?? []).length >= 1);
    for (const s of ['>v0 = 20 m/s<', '>30°<', '>H<', '>R<']) assert.ok(svg.includes(s), s);
  });
  it('draws the wave words in the language asked for', () => {
    const w: SceneFigure = { kind: 'wave', cycles: 1, marks: ['crest', 'trough'] };
    assert.ok(figureSvg(w, { lang: 'ar' }).includes('>قمة<'));
    assert.ok(figureSvg(w, { lang: 'en' }).includes('>crest<'));
  });
  it('gives each drawing its own clip id, so two on one page do not share one', () => {
    const id = (svg: string) => /<clipPath id="([^"]+)"/.exec(svg)?.[1];
    const a = figureSvg(proj);
    const b = figureSvg(proj);
    assert.ok(id(a) && id(b) && id(a) !== id(b));
    assert.equal(id(figureSvg(proj, { id: 'q3' })), 'fig-q3');
  });
});
