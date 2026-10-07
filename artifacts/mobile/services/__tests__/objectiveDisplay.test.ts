import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { displayObjective } from '../objectiveDisplay.ts';

describe('displayObjective', () => {
  it('reads a leading «تعرُّف» as «معرفة», whatever its diacritics', () => {
    assert.equal(displayObjective('تعرُّف مفهوم الاقتران المركّب وشرط تركيب اقترانين'), 'معرفة مفهوم الاقتران المركّب وشرط تركيب اقترانين');
    assert.equal(displayObjective('تعرّف أنواع الروابط الكيميائية'), 'معرفة أنواع الروابط الكيميائية');
    assert.equal(displayObjective('تعرف تركيب الخلية النباتية'), 'معرفة تركيب الخلية النباتية');
  });

  it('keeps a bullet or leading space in front of it', () => {
    assert.equal(displayObjective('• تعرُّف عدد الحلول الممكنة'), '• معرفة عدد الحلول الممكنة');
    assert.equal(displayObjective('  تعرُّف عدد الحلول'), '  معرفة عدد الحلول');
  });

  it('leaves other constructions and mid-sentence uses alone', () => {
    for (const s of [
      'التعرُّف إلى خصائص الاقتران',
      'حل نظام مكوَّن من معادلة خطية وأخرى تربيعية',
      'نمذجة مسألة حياتية ثم تعرُّف عدد حلولها',
      'تعرفة الرسوم', // a different word that merely starts the same way
      '',
    ]) {
      assert.equal(displayObjective(s), s, s);
    }
  });
});
