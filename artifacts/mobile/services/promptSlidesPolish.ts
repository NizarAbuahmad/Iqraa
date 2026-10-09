/**
 * Two repairs made to a generated deck locally, before it is ever shown.
 *
 * Both exist because of the same measured defect. `deckShortfalls` on the
 * server logs `N/10 slides are a single unbroken line` on real generations —
 * the model, on the cheap generation model, keeps writing a slide whose whole
 * body is one sentence. The prompt has been tightened twice against this and
 * it still happens, so the remaining options are to pay for a bigger model or
 * to stop rendering the result badly. This is the second one, and it costs
 * nothing: no network, no key, no completion.
 *
 * A one-sentence slide drawn the ordinary way is a title, one bullet, and a
 * screenful of empty — it reads as a feature that half-worked. Drawn as a
 * `statement` it reads as deliberate, which is what a single strong sentence
 * on a projector is supposed to look like. Nothing here writes content: it
 * only decides how the model's own words are laid out, and drops the ones that
 * say nothing at all.
 *
 * `compare` and `stat` are deliberately NOT inferred. Both need data the model
 * did not emit — two named columns, or a figure split from its label — and
 * deriving them from prose means guessing at the split. A wrong guess here is
 * a lopsided or mislabelled slide on a wall in front of a class, which is
 * worse than the ordinary layout it replaced. The model can still ask for
 * either one explicitly; this pass just never invents one.
 *
 * Pure and react-free so the bare `node --test` runner can load it.
 */
import type { ActivitySlide, ClassroomActivity } from './ai/AIService.ts';
import { isBulletLine, looksLikeEquation, stripBullet } from './deckText.ts';
import { MAX_STATEMENT_CHARS, inlineSteps, resolveSlideLayout } from './slideLayout.ts';
import { rebuildAnswerKey } from './lessonSlides.ts';

/**
 * Below this a slide body is not short, it is absent — a heading with a
 * handful of words under it that the class reads before the teacher has
 * finished saying the title.
 */
const MIN_CONTENT_CHARS = 12;

/** The floor the server's `assertUsableDeck` already enforces. Never go under it. */
const MIN_SLIDES = 5;

/** Two steps are a pair, not a process — same bar `resolveSlideLayout` applies. */
const MIN_INFERRED_STEPS = 2;

/**
 * Types whose body is plain prose, and therefore the only ones a layout may be
 * inferred for or a drop considered on.
 *
 * Everything else carries a payload the layout branch would hide: `question`
 * has options and a correct index, `graph` has commands, `media` has a URL,
 * `divider` is legitimately a bare section title. `summary` is prose but
 * closes the deck, so it is never dropped — a deck that ends mid-thought is
 * worse than one that ends thinly.
 */
const PROSE_TYPES = new Set<ActivitySlide['type']>(['intro', 'reveal', 'summary']);

function lines(content: string | undefined): string[] {
  return (content ?? '').split('\n').map(l => l.trim()).filter(Boolean);
}

/** A title or body that announces an ordered procedure rather than a list. */
function readsAsSequence(slide: ActivitySlide, body: string[]): boolean {
  if (/خطوات|الخطوة|كيف|طريقة|مراحل|\bsteps?\b|\bhow to\b|\bprocess\b/i.test(slide.title ?? '')) return true;
  // Or the model numbered them itself, which is the same claim made in the body.
  return body.every(l => /^[0-9٠-٩]+\s*[.)\-–]/.test(stripBullet(l)));
}

/** What `inferLayout` decided: the layout, and the body rewritten for it when it needs to be. */
type InferredLayout = { layout: NonNullable<ActivitySlide['layout']>; content?: string };

/**
 * The layout this slide should have been given, or `undefined` to leave it
 * alone.
 *
 * Conservative by construction: a slide the model already shaped, illustrated,
 * or gave a non-prose payload is never touched, and the result is put back
 * through `resolveSlideLayout` before it is kept. That second check is the
 * point — it is the same gate all three renderers ask, so a layout this
 * function infers can never be one a renderer would then refuse to draw and
 * leave blank.
 */
function inferLayout(slide: ActivitySlide, index: number): InferredLayout | undefined {
  if (slide.layout) return undefined;                 // the model asked; respect it
  if (index === 0) return undefined;                  // the cover has its own shape
  if (!PROSE_TYPES.has(slide.type)) return undefined;
  // A picture — asked for or already fetched — renders beside the text, and
  // the layout branch precedes that column in every renderer. Taking the
  // layout would silently cost the slide its photo.
  if (slide.mediaPrompt || slide.sideImageUrl || slide.mediaUrl || slide.visual || slide.graphCommands) {
    return undefined;
  }

  const body = lines(slide.content);
  if (body.length === 0) return undefined;

  if (body.length === 1) {
    const text = stripBullet(body[0]!);
    // A procedure written on one line («1) … 2) … 3) …») is a sequence, not a
    // sentence — set as a statement it would be one long run of numbered clauses
    // in display type. Its steps become the bullets the steps layout draws.
    const procedure = inlineSteps(text);
    if (procedure) return { layout: 'steps', content: procedure.map(step => `• ${step}`).join('\n') };
    // An equation already has its own boxed, centred rendering in the ordinary
    // layout (`looksLikeEquation`), which is better than setting it in display
    // type as if it were a sentence.
    if (looksLikeEquation(text) || text.length > MAX_STATEMENT_CHARS) return undefined;
    return { layout: 'statement' };
  }

  const bullets = body.filter(isBulletLine);
  if (bullets.length === body.length && bullets.length >= MIN_INFERRED_STEPS && readsAsSequence(slide, body)) {
    return { layout: 'steps' };
  }
  return undefined;
}

/** A slide whose body says nothing — see `MIN_CONTENT_CHARS`. */
function isHollow(slide: ActivitySlide): boolean {
  return lines(slide.content).map(stripBullet).join(' ').length < MIN_CONTENT_CHARS;
}

/**
 * A question slide whose answer the class would be shown must point at a real
 * option. The model's `correctIndex` arrives unchecked: a 1-based count, a
 * string, or an index past the end highlights the wrong option — or none — when
 * the teacher reveals it, in front of the class. Only a whole number inside the
 * option list survives (a numeric string is read as that number).
 *
 * Anything else is turned into an open check: the stem and its options stay on
 * the wall, but nothing claims to know which one is right. We do not guess a
 * 0-based index from a 1-based one — a wrong guess is the bug.
 */
function repairQuestion(slide: ActivitySlide): ActivitySlide {
  if (slide.type !== 'question') return slide;
  const options = (Array.isArray(slide.options) ? slide.options : [])
    .map(o => (typeof o === 'string' ? o.trim() : ''));
  const raw: unknown = slide.correctIndex;
  const index = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : raw;
  const sound = options.length >= 2
    && options.every(Boolean)
    && new Set(options).size === options.length
    && typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < options.length;
  if (sound) return { ...slide, options, correctIndex: index as number };

  const { options: _o, correctIndex: _c, verified: _v, verifiedBy: _b, computedAnswer: _a, ...rest } = slide;
  const listed = options.filter(Boolean).map(o => `• ${o}`);
  return { ...rest, type: 'challenge', content: [slide.content, ...listed].filter(Boolean).join('\n') };
}

/**
 * Drop the slides that say nothing, then draw the rest in the shape their own
 * content asks for.
 *
 * Dropping stops at `MIN_SLIDES` rather than at zero, and never touches the
 * cover or the closing summary: six solid slides beat ten with three blanks,
 * but a deck that loses its opening or its ending has lost more than it
 * gained. When the floor is what stops the drop the thin slides stay — the
 * teacher can see them and delete them, which beats handing back a deck
 * shorter than the one the server certified.
 */
export function polishDeck(deck: ClassroomActivity, isAr = true): ClassroomActivity {
  const hollow = new Set<number>();
  deck.slides.forEach((slide, index) => {
    if (index === 0 || slide.type === 'summary') return;
    if (!PROSE_TYPES.has(slide.type)) return;
    // A slide the model gave a layout keeps its substance somewhere other than
    // `content` — the figure and its caption live in `stat`, the two columns in
    // `compare` — so measuring its body would drop the best slide in the deck.
    if (slide.layout) return;
    if (deck.slides.length - hollow.size <= MIN_SLIDES) return;
    if (isHollow(slide)) hollow.add(index);
  });

  const kept = deck.slides.filter((_, index) => !hollow.has(index)).map(repairQuestion);
  const slides = kept.map((slide, index) => {
    const inferred = inferLayout(slide, index);
    if (!inferred) return { ...slide, slideNumber: index + 1 };
    const withLayout = { ...slide, ...inferred, slideNumber: index + 1 };
    // The renderers' own gate, asked before the layout is kept rather than
    // after it is drawn.
    return resolveSlideLayout(withLayout) ? withLayout : { ...slide, slideNumber: index + 1 };
  });

  // The printed key is derived from the slides that will be projected, so the
  // two cannot disagree. The model's own list stays only when no slide carries
  // an answer to derive one from.
  const answerKey = rebuildAnswerKey(slides, isAr);
  return { ...deck, slides, answerKey: answerKey.length > 0 ? answerKey : deck.answerKey };
}
