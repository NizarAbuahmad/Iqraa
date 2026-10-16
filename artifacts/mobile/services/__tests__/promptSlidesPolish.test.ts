/**
 * The local repairs made to a generated deck — no network, no model.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesPolish.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { polishDeck } from '../promptSlidesPolish.ts';
import { resolveSlideLayout } from '../slideLayout.ts';
import type { ActivitySlide, ClassroomActivity } from '../ai/AIService.ts';
import type { VisualBlock } from '../deckVisuals.ts';



const slide = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 1, type: 'intro', title: 'عنوان', content: '• سطر أول\n• سطر ثانٍ', durationSeconds: 0, ...over,
});

const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
  activityName: 'عرض', activityType: 'prompt-slides', grade: 'العاشر', subject: 'الرياضيات',
  lesson: 'المستقيمات', duration: 30, difficulty: 'standard', groupType: 'whole-class',
  learningObjective: 'هدف', materials: [], teacherPreparation: '', slides,
  teacherNotes: [], answerKey: [], printables: [], assessment: '', extensionChallenge: '',
});

/** Enough filler to keep a deck clear of the MIN_SLIDES floor. */
const padding = (n: number) => Array.from({ length: n }, () => slide());

describe('polishDeck — inferring a layout', () => {
  it('draws a one-sentence slide as a statement instead of a lonely bullet', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'الدالة الخطية تربط بين متغيرين بعلاقة ثابتة المعدل.' }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'statement');
  });

  it('never infers a layout a renderer would then refuse to draw', () => {
    // The guarantee that matters: whatever this pass sets, the gate all three
    // renderers ask must accept — otherwise the slide draws blank on a wall.
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'جملة قصيرة.' }),
      slide({ title: 'خطوات الحل', content: '• اجمع الحدود\n• اقسم على المعامل' }),
      ...padding(3),
    ]));
    for (const s of out.slides) {
      if (s.layout) assert.ok(resolveSlideLayout(s), `layout ${s.layout} does not resolve`);
    }
  });

  it('numbers a bulleted procedure as steps, and leaves an unordered list alone', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ title: 'خطوات الحل', content: '• اجمع الحدود\n• اقسم على المعامل' }),
      slide({ title: 'أمثلة', content: '• مثال أول\n• مثال ثانٍ' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[1]!.layout, 'steps');
    assert.equal(out.slides[2]!.layout, undefined, 'a plain list is not a process');
  });

  it('leaves the model’s own choice of layout untouched', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'stat', content: 'سطر واحد', stat: { value: '70%', label: 'من الطلبة' } }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'stat');
  });

  it('does not take the layout of a slide that is getting a photo', () => {
    // A layout renders through its own branch and never reaches the side-image
    // column, so taking it here would silently cost the slide its picture.
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'جملة واحدة قصيرة.', mediaPrompt: 'straight line graph' }),
      slide({ content: 'جملة أخرى قصيرة.', sideImageUrl: 'https://img/x.jpg' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[1]!.layout, undefined);
    assert.equal(out.slides[2]!.layout, undefined);
  });

  it('leaves an equation in the ordinary layout, which already boxes it', () => {
    const out = polishDeck(deck([slide(), slide({ content: 'y = 2x + 1' }), ...padding(4)]));
    assert.equal(out.slides[1]!.layout, undefined);
  });

  it('leaves the cover and the non-prose slides alone', () => {
    const out = polishDeck(deck([
      slide({ content: 'عنوان العرض' }),
      slide({ type: 'question', content: 'ما الناتج؟', options: ['1', '2'], correctIndex: 0 }),
      slide({ type: 'divider', content: 'القسم الثاني' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[0]!.layout, undefined);
    assert.equal(out.slides[1]!.layout, undefined);
    assert.equal(out.slides[2]!.layout, undefined);
  });
});

describe('polishDeck — dropping what says nothing', () => {
  it('drops a hollow prose slide and renumbers what is left', () => {
    const out = polishDeck(deck([slide(), slide({ content: '•' }), ...padding(5)]));
    assert.equal(out.slides.length, 6);
    assert.ok(!out.slides.some(s => s.content.trim() === '•'));
    out.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });

  it('keeps the deck at the server’s five-slide floor rather than going under it', () => {
    const before = deck([slide(), ...Array.from({ length: 4 }, () => slide({ content: '•' }))]);
    const out = polishDeck(before);
    assert.equal(out.slides.length, before.slides.length);
  });

  it('never drops the cover or the closing summary, however thin', () => {
    const out = polishDeck(deck([
      slide({ content: '•' }),
      ...padding(5),
      slide({ type: 'summary', content: '•' }),
    ]));
    assert.equal(out.slides[0]!.content, '•');
    assert.equal(out.slides.at(-1)!.type, 'summary');
  });

  it('never drops a short slide that carries a payload instead of prose', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ type: 'graph', content: '', graphCommands: ['y=2x+1'] }),
      slide({ type: 'divider', content: 'القسم الثاني' }),
      ...padding(4),
    ]));
    assert.ok(out.slides.some(s => s.type === 'graph'));
    assert.ok(out.slides.some(s => s.type === 'divider'));
  });

  it('leaves a deck with nothing wrong with it exactly as it was', () => {
    const before = deck(padding(6));
    const out = polishDeck(before);
    assert.equal(out.slides.length, 6);
    assert.ok(!out.slides.some(s => s.layout));
  });
});

describe('polishDeck — a question slide only claims an answer it can point at', () => {
  const q = (over: Partial<ActivitySlide> = {}): ActivitySlide => slide({
    type: 'question', title: 'سؤال', content: 'ما ناتج 2 + 2؟',
    options: ['3', '4', '5', '6'], correctIndex: 1, ...over,
  });
  const polishedQuestion = (s: ActivitySlide) => polishDeck(deck([slide(), s, ...padding(5)])).slides[1]!;

  it('leaves a sound question alone', () => {
    const out = polishedQuestion(q());
    assert.equal(out.type, 'question');
    assert.equal(out.correctIndex, 1);
    assert.deepEqual(out.options, ['3', '4', '5', '6']);
  });

  it('reads a numeric string as its number', () => {
    assert.equal(polishedQuestion(q({ correctIndex: '2' as never })).correctIndex, 2);
  });

  it('turns an out-of-range, fractional or missing index into an open check, keeping the options readable', () => {
    for (const bad of [4, -1, 1.5, undefined, 'b', null]) {
      const out = polishedQuestion(q({ correctIndex: bad as never }));
      assert.equal(out.type, 'challenge', String(bad));
      assert.equal(out.correctIndex, undefined);
      assert.equal(out.options, undefined);
      assert.ok(out.content.includes('• 4') && out.content.includes('ما ناتج'), String(bad));
    }
  });

  it('refuses options it cannot tell apart', () => {
    assert.equal(polishedQuestion(q({ options: ['4', '4', '5', '6'] })).type, 'challenge');
    assert.equal(polishedQuestion(q({ options: ['4', '', '5', '6'] })).type, 'challenge');
  });

  it('prints the answer key from the slides, not from what the model said', () => {
    const d = deck([slide(), q(), ...padding(5)]);
    d.answerKey = ['سؤال: 3'];
    assert.deepEqual(polishDeck(d).answerKey, ['سؤال: 4']);
  });

  it('keeps the model key when no slide carries an answer to derive one from', () => {
    const d = deck([slide(), ...padding(5)]);
    d.answerKey = ['من النموذج'];
    assert.deepEqual(polishDeck(d).answerKey, ['من النموذج']);
  });
});

describe('polishDeck — a procedure written on one line', () => {
  const procedure = 'الخطوات: 1) عزل y من المعادلة الخطية 2) تعويضه في التربيعية 3) حل المعادلة الناتجة';

  it('becomes numbered steps rather than a long sentence in display type', () => {
    const out = polishDeck(deck([slide(), slide({ content: `• ${procedure}` }), ...padding(4)]));
    const s = out.slides[1]!;
    assert.equal(s.layout, 'steps');
    assert.equal(s.content, '• عزل y من المعادلة الخطية\n• تعويضه في التربيعية\n• حل المعادلة الناتجة');
    assert.equal(resolveSlideLayout(s)?.kind, 'steps');
  });

  it('leaves a one-line slide with only two numbered clauses as an ordinary statement', () => {
    const out = polishDeck(deck([slide(), slide({ content: 'تعرّف أولًا 1) الفكرة 2) والمثال' }), ...padding(4)]));
    assert.equal(out.slides[1]!.layout, 'statement');
  });
});

describe('polishDeck — the structure a model chose', () => {
  const chart: VisualBlock = { kind: 'chart', chartType: 'pie', categories: ['سكن', 'طعام', 'نقل'], values: [50, 30, 20] };

  it('keeps an icon the app can draw and deletes one it cannot', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ title: 'ذرة', icon: 'atom' }),
      slide({ title: 'صاروخ', icon: 'rocket' as never }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.icon, 'atom');
    assert.equal('icon' in out.slides[2]!, false);
  });

  it('keeps a valid chart and cleans it', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ title: 'مصروف الأسرة', visual: { ...chart, values: ['50', '30', '20'] as never } }),
      ...padding(4),
    ]));
    assert.deepEqual(out.slides[1]!.visual, chart);
  });

  it('deletes a chart that fails the gate, and the reveal flag that went with it', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ visual: { ...chart, values: [1, 2] } as never, visualOnReveal: true }),
      ...padding(4),
    ]));
    assert.equal('visual' in out.slides[1]!, false);
    assert.equal('visualOnReveal' in out.slides[1]!, false);
  });

  it('never drops a chart slide for having a short body — the chart is the substance', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ title: 'الأرقام', content: 'انظر', visual: chart }),
      ...padding(5),
    ]));
    assert.equal(out.slides.length, 7);
    assert.ok(out.slides[1]!.visual);
  });

  it('a chart on a laid-out slide is dropped — the layout fills the slide in all three renderers', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'statement', content: 'جملة واحدة قصيرة', visual: chart }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'statement');
    assert.equal('visual' in out.slides[1]!, false);
  });

  it('a chart displaces the photo request on its slide', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ visual: chart, mediaPrompt: 'household budget' }),
      slide({ mediaPrompt: 'river delta' }),
      ...padding(3),
    ]));
    assert.equal('mediaPrompt' in out.slides[1]!, false);
    assert.equal(out.slides[2]!.mediaPrompt, 'river delta');
  });

  it('does not touch a deck that carries neither', () => {
    const before = deck([slide(), ...padding(5)]);
    const out = polishDeck(before);
    assert.deepEqual(out.slides.map(s => s.title), before.slides.map(s => s.title));
    assert.ok(out.slides.every(s => !('icon' in s) && !('visual' in s)));
  });
});

describe('polishDeck — the structure layouts', () => {
  const events = [
    { label: '١٩٢١', text: 'تأسيس الإمارة' },
    { label: '١٩٤٦', text: 'الاستقلال' },
    { label: '١٩٥٢', text: 'الدستور' },
  ];

  it('keeps a layout whose data the app can draw, payload untouched', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'timeline', content: 'ثلاث محطات', timeline: events }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'timeline');
    assert.deepEqual(out.slides[1]!.timeline, events);
    assert.equal(resolveSlideLayout(out.slides[1]!)?.kind, 'timeline');
  });

  it('a refused layout keeps its sentence and gains the payload as a list — never a blank slide', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'timeline', content: 'محطات مهمة', timeline: events.slice(0, 2) }),
      ...padding(4),
    ]));
    const refused = out.slides[1]!;
    assert.equal('layout' in refused, false);
    assert.equal('timeline' in refused, false);
    assert.equal(refused.content, 'محطات مهمة\n• ١٩٢١ — تأسيس الإمارة\n• ١٩٤٦ — الاستقلال');
  });

  it('a refused layout with no sentence still shows its words', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'flow', content: '', flow: { steps: ['يتبخّر الماء من البحر', 'يتكاثف البخار في السماء'] } }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.content, '• يتبخّر الماء من البحر\n• يتكاثف البخار في السماء');
  });

  it('a refused layout whose words are only a few short ones is dropped as hollow, like any thin slide', () => {
    // «تبخّر» and «تكاثف» as two bullets say nothing the class cannot read in a
    // second; the existing floor on thin slides applies to the fallback too.
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'flow', content: '', flow: { steps: ['تبخّر', 'تكاثف'] } }),
      ...padding(5),
    ]));
    assert.equal(out.slides.length, 6);
  });

  it('turns a refused table into one line per row, headed by its column names', () => {
    const out = polishDeck(deck([
      slide(),
      slide({
        layout: 'table', content: '',
        table: { headers: ['الدولة', 'العاصمة'], rows: [['الأردن', 'عمّان'], ['مصر']] },
      }),
      ...padding(4),
    ]));
    assert.match(out.slides[1]!.content, /• الدولة: الأردن — العاصمة: عمّان/);
  });

  it('cuts a long refused list rather than printing a wall', () => {
    const many = Array.from({ length: 10 }, (_, i) => `خطوة ${i + 1}`);
    const out = polishDeck(deck([slide(), slide({ layout: 'flow', content: 'عملية', flow: { steps: many } }), ...padding(4)]));
    assert.equal(out.slides[1]!.content.split('\n').filter(l => l.startsWith('• ')).length, 6);
  });

  it('a layout on a question slide is removed — it would hide the options', () => {
    const out = polishDeck(deck([
      slide(),
      slide({
        type: 'question', layout: 'stats', content: 'ما الجواب؟', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 1,
        stats: [{ value: '1', label: 'أ' }, { value: '2', label: 'ب' }],
      }),
      ...padding(4),
    ]));
    const q = out.slides[1]!;
    assert.equal('layout' in q, false);
    assert.equal(q.type, 'question');
    assert.deepEqual(q.options, ['أ', 'ب', 'ج', 'د']);
  });

  it('a chart on a timeline slide is dropped, like on any laid-out slide', () => {
    const out = polishDeck(deck([
      slide(),
      slide({
        layout: 'timeline', timeline: events, content: 'محطات',
        visual: { kind: 'chart', chartType: 'bar', categories: ['أ', 'ب'], values: [1, 2] },
      }),
      ...padding(4),
    ]));
    assert.equal('visual' in out.slides[1]!, false);
    assert.equal(out.slides[1]!.layout, 'timeline');
  });

  it('a laid-out slide with a one-line body is not dropped as hollow', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'stats', content: 'أرقام', stats: [{ value: '٣', label: 'أ' }, { value: '٤', label: 'ب' }] }),
      ...padding(5),
    ]));
    assert.equal(out.slides.length, 7);
  });
});
