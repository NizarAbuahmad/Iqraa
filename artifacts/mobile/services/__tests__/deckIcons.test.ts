/**
 * deckIcons.ts — the section icons a deck heading carries.
 *
 * The contract: a mapped emoji becomes a stroked SVG in the slide's accent, an
 * unmapped one comes back `null` so the caller keeps drawing the emoji, and the
 * single shape table is complete enough that neither renderer can be handed a
 * name it cannot draw.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DECK_ICON_SHAPES, deckIconSvg, iconForGlyph, iconForTopic, photoQueryForTopic, type DeckIconName } from '../deckIcons.ts';
import { splitEmoji } from '../deckText.ts';
import { buildDeckSlidesHTML } from '../deckSlidesHtml.ts';
import type { ActivitySlide, ClassroomActivity } from '../ai/AIService.ts';
import { DECK_SECTION_ICONS, isSectionIconName } from '../deckIcons.ts';


describe('iconForGlyph', () => {
  it('maps the lesson deck’s section markers to icons', () => {
    assert.equal(iconForGlyph('🎯'), 'target');
    assert.equal(iconForGlyph('📖'), 'book');
    assert.equal(iconForGlyph('💡'), 'bulb');
    assert.equal(iconForGlyph('📐'), 'ruler');
    assert.equal(iconForGlyph('🎉'), 'flag');
    assert.equal(iconForGlyph('🏠'), 'home');
  });

  it('ignores a trailing variation selector, as splitEmoji and a pasted emoji differ on it', () => {
    assert.equal(iconForGlyph('✍️'), 'pencil');
    assert.equal(iconForGlyph('✍'), 'pencil');
  });

  it('lets two glyphs that mean the same to a class share a picture', () => {
    assert.equal(iconForGlyph('✋'), iconForGlyph('❓'));
  });

  it('returns null for a glyph with no entry, so the emoji is still drawn', () => {
    assert.equal(iconForGlyph('🔓'), null);   // an escape-room game's unlock, where the emoji is the point
    assert.equal(iconForGlyph('🕵'), null);
    assert.equal(iconForGlyph(''), null);
  });

  it('only ever names an icon the table can draw', () => {
    for (const g of ['🎯', '📖', '📚', '💡', '📐', '🎉', '🏠', '🤝', '✋', '🙋', '❓', '✍', '🎫', '✨', '🏆', '📊', '📈', '✅']) {
      const name = iconForGlyph(g);
      assert.ok(name, `${g} has no icon`);
      assert.ok(DECK_ICON_SHAPES[name!].length > 0, `${name} has no shapes`);
    }
  });
});

describe('iconForTopic', () => {
  it('names the subject of a unit, in Arabic and English', () => {
    const cases: [string, string][] = [
      ['الحركة والقوة', 'atom'],
      ['علوم الأرض والفضاء', 'globe'],
      ['النباتات والخلايا', 'leaf'],
      ['الطاقة والحرارة', 'sun'],
      ['الكسور والأعداد', 'calculator'],
      ['التفاعلات الكيميائية', 'flask'],
      ['Forces and Motion', 'atom'],
      ['Earth and Space', 'globe'],
      ['Fractions', 'calculator'],
      ['Reading and Writing', 'book'],
    ];
    for (const [text, icon] of cases) assert.equal(iconForTopic(text), icon, text);
  });

  it('has no opinion rather than a wrong one', () => {
    // «Unit» and «وحدة» are the word for a unit of the book, not a topic
    for (const text of ['وحدة عامة', 'Unit 3', '']) assert.equal(iconForTopic(text), null, text);
    assert.equal(iconForTopic(undefined as never), null);
  });

  it('only ever returns an icon the renderers can draw', () => {
    for (const text of ['الحركة', 'الأرض', 'water', 'history', 'computer', 'السكان والمجتمع']) {
      const icon = iconForTopic(text);
      if (icon !== null) assert.ok(isSectionIconName(icon), `${text} → ${icon}`);
    }
  });
});

describe('photoQueryForTopic', () => {
  it('is an English query for a recognised topic and null otherwise', () => {
    assert.match(photoQueryForTopic('الحركة والقوة')!, /physics/);
    assert.match(photoQueryForTopic('علوم الأرض والفضاء')!, /earth/);
    assert.equal(photoQueryForTopic('وحدة عامة'), null);
    assert.equal(photoQueryForTopic(''), null);
  });

  it('every icon a topic can resolve to has a query — no recognised topic ends up photo-less by accident', () => {
    // The only icons without one are the section markers a topic never maps to.
    const topicIcons = new Set(['flask', 'atom', 'leaf', 'sun', 'drop', 'globe', 'heart', 'bars', 'calculator', 'ruler', 'clock', 'laptop', 'users', 'pin', 'book']);
    for (const icon of topicIcons) {
      const sample: Record<string, string> = {
        flask: 'كيمياء', atom: 'فيزياء', leaf: 'نبات', sun: 'طاقة', drop: 'ماء', globe: 'الأرض', heart: 'صحة',
        bars: 'إحصاء', calculator: 'جبر', ruler: 'قياس', clock: 'تاريخ', laptop: 'حاسوب', users: 'مجتمع', pin: 'خريطة', book: 'قراءة',
      };
      assert.equal(iconForTopic(sample[icon]!), icon, `${icon} sample`);
      assert.ok(photoQueryForTopic(sample[icon]!), `${icon} has a photo query`);
    }
  });
});

describe('DECK_ICON_SHAPES', () => {
  it('draws every icon from at least one shape, all on the 24-unit grid', () => {
    for (const [name, shapes] of Object.entries(DECK_ICON_SHAPES)) {
      assert.ok(shapes.length > 0, `${name} is empty`);
      for (const s of shapes) {
        if (s.t === 'circle') {
          assert.ok(s.cx - s.r >= 0 && s.cx + s.r <= 24 && s.cy - s.r >= 0 && s.cy + s.r <= 24, `${name} circle leaves the grid`);
        }
        if (s.t === 'rect') {
          assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= 24 && s.y + s.h <= 24, `${name} rect leaves the grid`);
        }
        if (s.t === 'path') assert.match(s.d, /^M/, `${name} path does not start with a move`);
      }
    }
  });
});

describe('deckIconSvg', () => {
  const svg = deckIconSvg('target' as DeckIconName, '#006D65', 34);

  it('states its colour and size outright, not as currentColor', () => {
    assert.match(svg, /stroke="#006D65"/);
    assert.match(svg, /width="34" height="34"/);
    assert.doesNotMatch(svg, /currentColor/);
  });

  it('is decorative — hidden from assistive tech, because the heading beside it says the same', () => {
    assert.match(svg, /aria-hidden="true"/);
  });

  it('is a self-contained, closed element', () => {
    assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"[^>]*>.*<\/svg>$/s);
    assert.equal((svg.match(/<circle /g) ?? []).length, 3);
  });
});

describe('the deck header', () => {
  const slide = (title: string): ActivitySlide => ({
    slideNumber: 2, type: 'intro', title, content: '• سطر', durationSeconds: 0,
  });
  const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
    activityName: 'x', activityType: 'lesson-slides', grade: '', subject: '', lesson: '', duration: 45,
    difficulty: 'standard', groupType: 'whole-class', learningObjective: '', materials: [],
    teacherPreparation: '', teacherNotes: [], answerKey: [], printables: [], assessment: '',
    extensionChallenge: '', slides,
  });
  const header = (title: string) => {
    const html = buildDeckSlidesHTML(deck([slide('عنوان'), slide(title)]), true);
    return html.slice(html.lastIndexOf('</style>')).split('class="deck-header"')[1] ?? '';
  };

  it('draws a mapped section glyph as an SVG in the accent, with no emoji beside it', () => {
    const h = header('🎯 نتاجات التعلم');
    assert.match(h, /<svg class="deck-icon"/);
    assert.match(h, /stroke="#006D65"/);
    assert.doesNotMatch(h, /🎯/);
  });

  it('keeps the emoji for a glyph the table has no icon for', () => {
    const h = header('🔓 الكود 4 مفتوح!');
    assert.match(h, /🔓/);
    assert.doesNotMatch(h, /<svg/);
  });

  it('draws no icon when the title has no glyph', () => {
    assert.doesNotMatch(header('الحلول الممكنة'), /<svg|deck-emoji/);
  });
});

describe('section glyphs the builders write', () => {
  // The lesson and class decks' own headings. A new section emoji that is not
  // in the table still renders (as the emoji), so this is a nudge, not a gate:
  // it fails when a builder starts using a marker nobody mapped.
  const written = [
    '🎯 نتاجات التعلم', '📖 مفردات الدرس', '✨ تمهيد', '💡 أفكار الدرس', '📐 القاعدة',
    '✋ تحقّق سريع 1', '🤝 تدريب موجّه', '✍ تدريب مستقل', '🎉 ملخص الدرس', '🎫 غلق الدرس',
    '🏠 الواجب', '📚 درس', '✍ مثال محلول', '📊 الترتيب الحالي', '🏆 النتيجة النهائية',
    '📈 الرسم البياني', '📊 البيانات',
  ];
  it('all have an icon', () => {
    for (const title of written) {
      const [glyph] = splitEmoji(title);
      assert.ok(iconForGlyph(glyph), `no icon for the glyph in «${title}»`);
    }
  });
});

describe('inline icons in the HTML export', () => {
  const GLYPHS = [0x1F6E1, 0x1F4DA, 0x25B6, 0x1F4C4, 0x2713].map(c => String.fromCodePoint(c));
  const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
    activityName: 'x', activityType: 'lesson-slides', grade: '', subject: '', lesson: '', duration: 45,
    difficulty: 'standard', groupType: 'whole-class', learningObjective: '', materials: [],
    teacherPreparation: '', teacherNotes: [], answerKey: [], printables: [], assessment: '',
    extensionChallenge: '', slides,
  });
  const cover: ActivitySlide = { slideNumber: 1, type: 'intro', title: 'درس', content: 'م', durationSeconds: 0 };
  const html = (slides: ActivitySlide[]) => {
    const full = buildDeckSlidesHTML(deck([cover, ...slides]), true);
    return full.slice(full.lastIndexOf('</style>'));
  };
  const media = (kind: 'video' | 'audio' | 'document'): ActivitySlide => ({
    slideNumber: 2, type: 'media', mediaKind: kind, title: 'وسائط', content: '', mediaUrl: 'https://example.com/a', durationSeconds: 0,
  });

  it('draws the video, audio and document links with an icon, not a glyph', () => {
    for (const kind of ['video', 'audio', 'document'] as const) {
      const out = html([media(kind)]);
      assert.match(out, /<a class="deck-video-link"[^>]*><svg class="deck-icon-inline"/, kind);
      for (const g of GLYPHS) assert.ok(!out.includes(g), `${kind} still prints ${g}`);
    }
  });

  it('draws the verified badge with an icon in the badge colour, for both ways of being verified', () => {
    const challenge = (verifiedBy: 'symbolic' | 'bank'): ActivitySlide => ({
      slideNumber: 2, type: 'challenge', title: 'مثال', content: 'x = 1', answer: 'x = 1',
      verified: true, verifiedBy, durationSeconds: 0,
    } as ActivitySlide);
    const symbolic = html([challenge('symbolic')]);
    assert.match(symbolic, /class="deck-verified"[^>]*>\s*<svg class="deck-icon-inline"[^>]*stroke="#22C55E"/);
    const bank = html([challenge('bank')]);
    assert.match(bank, /class="deck-verified"[^>]*>\s*<svg class="deck-icon-inline"/);
    assert.doesNotMatch(bank, /stroke="#22C55E"/);
    for (const g of GLYPHS) assert.ok(!symbolic.includes(g) && !bank.includes(g), `badge still prints ${g}`);
  });

  it('marks the correct option with an icon tick', () => {
    const q: ActivitySlide = {
      slideNumber: 2, type: 'question', title: 'سؤال', content: 'ما الناتج؟', options: ['1', '2'], correctIndex: 1, durationSeconds: 0,
    };
    const out = html([q]);
    assert.match(out, /class="deck-option-tick"[^>]*><svg class="deck-icon-inline"/);
    assert.equal((out.match(/class="deck-option-tick"/g) ?? []).length, 1, 'only the correct option is ticked');
    assert.ok(!out.includes(String.fromCodePoint(0x2713)));
  });

  it('only names icons the table can draw', () => {
    for (const name of ['shield', 'play', 'file', 'tick', 'books'] as const) {
      assert.ok(DECK_ICON_SHAPES[name].length > 0, name);
    }
  });
});

describe('DECK_SECTION_ICONS — the names a model may ask for', () => {
  it('every name has a drawing, and every drawing makes real SVG', () => {
    for (const name of DECK_SECTION_ICONS) {
      assert.ok(DECK_ICON_SHAPES[name]?.length > 0, `${name} has no shapes`);
      const svg = deckIconSvg(name, '#0B5894', 40);
      assert.match(svg, /^<svg /);
      assert.ok(/<(path|circle|rect)/.test(svg), `${name} drew nothing`);
    }
  });

  it('has no duplicates and none of the inline marks', () => {
    assert.equal(new Set(DECK_SECTION_ICONS).size, DECK_SECTION_ICONS.length);
    for (const inline of ['shield', 'play', 'file', 'tick']) {
      assert.ok(!(DECK_SECTION_ICONS as readonly string[]).includes(inline), inline);
    }
  });

  it('reaches past the generic markers into what a lesson is about', () => {
    for (const subject of ['atom', 'flask', 'leaf', 'globe', 'calculator', 'clock', 'pin', 'heart', 'star', 'sun', 'drop', 'laptop']) {
      assert.ok(isSectionIconName(subject), subject);
    }
  });

  it('refuses anything else, including values a model could invent', () => {
    for (const bad of ['rocket', '', 'Atom', 'shield', 'toString', '__proto__', 7, null, undefined, {}]) {
      assert.equal(isSectionIconName(bad), false, String(bad));
    }
  });

  it('keeps the tilted atom orbits inside the 24-unit grid', () => {
    // The two slanted ellipses use SVG arc rotation; a typo in an endpoint
    // would push an orbit off the edge of the chip without any error.
    const nums = DECK_ICON_SHAPES.atom.flatMap(s => (s.t === 'path' ? s.d.match(/-?\d+(?:\.\d+)?/g) ?? [] : [])).map(Number);
    assert.ok(nums.every(n => Math.abs(n) <= 24 || [60, -60].includes(n)));
  });
});

describe('arrow and refresh — inline marks for the flow diagram', () => {
  it('are drawable, and are NOT names a model may pick for a heading', () => {
    for (const name of ['arrow', 'refresh'] as const) {
      assert.ok(DECK_ICON_SHAPES[name].length > 0, name);
      assert.match(deckIconSvg(name, '#000', 24), /<path/);
      assert.equal(isSectionIconName(name), false, `${name} sits inside a line, not in a title`);
      assert.ok(!(DECK_SECTION_ICONS as readonly string[]).includes(name));
    }
  });
});
