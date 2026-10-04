import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cellWidthPercent, isVisualKind, libraryColumns, previewCount } from '../libraryLayout.ts';

describe('libraryColumns', () => {
  it('picks the count from the track width, at the thresholds', () => {
    assert.equal(libraryColumns(320), 1);
    assert.equal(libraryColumns(599), 1);
    assert.equal(libraryColumns(600), 2);
    assert.equal(libraryColumns(959), 2);
    assert.equal(libraryColumns(960), 3);
    assert.equal(libraryColumns(1120), 3);
  });

  it('is 1 before the track has been measured', () => {
    assert.equal(libraryColumns(0), 1);
  });
});

describe('cellWidthPercent', () => {
  it('always leaves room for the 12px gaps', () => {
    // Content width is the track minus the 20px side padding; a row of n cells
    // plus n-1 gaps must fit it at the smallest track that yields n columns.
    for (const [cols, minTrack] of [[3, 960], [2, 600]] as const) {
      const content = minTrack - 40;
      const cell = (parseFloat(cellWidthPercent(cols)) / 100) * content;
      assert.ok(cell * cols + 12 * (cols - 1) <= content, `${cols} columns at ${minTrack}px`);
    }
    assert.equal(cellWidthPercent(1), '100%');
  });
});

describe('isVisualKind', () => {
  it('is true for kinds with a picture and false for the rest', () => {
    for (const k of ['video', 'infographic', 'image']) assert.equal(isVisualKind(k), true, k);
    for (const k of ['worksheet', 'template', 'document', 'presentation', 'audio', 'game', 'page']) {
      assert.equal(isVisualKind(k), false, k);
    }
  });
});

describe('previewCount', () => {
  it('shows at least one full row, so a preview never looks like the whole shelf', () => {
    for (const cols of [1, 2, 3] as const) {
      for (const visual of [true, false]) {
        assert.ok(previewCount(cols, visual) >= cols, `${cols} columns, visual=${visual}`);
      }
    }
    assert.equal(previewCount(3, true), 3);
    assert.equal(previewCount(1, true), 3);
  });
});
