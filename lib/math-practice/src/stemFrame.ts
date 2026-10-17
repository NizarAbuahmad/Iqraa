/**
 * The sentence a question is written in, with its numbers and symbols taken out.
 *
 * Two stems with one frame ask the same thing of different numbers: «حلّ
 * المعادلة x² + 3x − 18 = 0 بالتحليل» and «… x² − 11x + 28 = 0 …» are two
 * questions to a checker that compares text, and one question to a teacher
 * reading the paper. Measured 2026-10-15, one frame was on average 58% of an
 * offline maths quiz — so the topic generators spread their draws over frames
 * (`makeTopicItem`), and the evaluation validator warns when one frame
 * dominates a paper (`dominantFrame`).
 *
 * Word by word: a word with a digit or a maths symbol in it, or a single
 * letter (a variable), becomes `#`; any other word keeps its letters. That
 * keeps English stems readable («Solve #»), where stripping every Latin letter
 * would reduce them all to the same frame. Arabic-notation maths («ق(س) = ٢س»)
 * keeps its letter names, so it can only be under-counted, never merged with a
 * different ask.
 *
 * A blank the student fills («؟», «▢», «■», «___») stays in the frame as
 * `?`, with the numbers around it in the same word masked: «2/3 = ؟/12» and
 * «2/3 = 8/؟» ask for different things and used to be one frame (`# ?#` and
 * `# #?` now). A «؟» that ends a sentence is the question mark, not a blank.
 */

/** Text after the stem that is not part of the ask: a true/false item's
 *  proposed answer and the answer space a worksheet prints. */
const PADDING = /\n\n(?:الإجابة المقترحة|Proposed answer|الإجابة|Answer|مساحة العمل|Work space):[\s\S]*$/u;

const DIACRITICS = /[ً-ْٰـ]/gu;
const DIGIT = /[0-9٠-٩۰-۹²³¹⁰-⁹₀-₉½¼¾]/u;
const MATH = /[=+\-−–×÷*/^√∛π∞°′″≤≥<>≠≈±|()[\]{}·∑∫θ→⇌⟶]/u;
const LETTERS = /[^\p{L}]/gu;
/** A blank the student fills. «…» is not one: it ends a repeating decimal or a sequence. */
const SLOT = /▢|■|□|_{2,}|[؟?]/gu;
/** The question mark that ends a sentence: «؟» right after anything but a space or a maths symbol. */
const QUESTION_MARK = /(?<=[^\s=+\-−–×÷*/^√<>≤≥(:])[؟?](?=\s|$)/gu;

/** A word holding a blank: each blank becomes `?`, everything between blanks `#`. */
function slotted(word: string): string | null {
  if (!new RegExp(SLOT.source, 'u').test(word)) return null;
  return word.split(SLOT).map(part => (part ? '#' : '')).join('?');
}

export function stemFrame(text: string): string {
  const words = text.replace(PADDING, '').replace(DIACRITICS, '').replace(QUESTION_MARK, '').split(/\s+/u);
  const out: string[] = [];
  for (const word of words) {
    if (!word) continue;
    const letters = word.replace(LETTERS, '');
    const token = slotted(word) ?? (DIGIT.test(word) || MATH.test(word) || letters.length <= 1 ? '#' : letters.toLowerCase());
    if (token === '#' && out[out.length - 1] === '#') continue;
    out.push(token);
  }
  return out.join(' ');
}

/** Fresh draws a generator compares before keeping the one whose kind was served least. */
export const FRESH_DRAWS = 6;

/** Word-level edit distance between two frames. */
function wordDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}

/**
 * Two frames ask the same KIND of question when one is the other with a few
 * words swapped or moved — at most 37% of the longer one's words, and always
 * one: «ناتج جمع العدد #» / «ناتج ضرب العدد # في #» / «ناتج طرح # من العدد #»,
 * «ما العدد السابق للعدد #» / «… التالي …», «بعد # ساعات» / «بعد ساعة واحدة».
 * Measured on the generators' own sentences (2026-10-16): rewordings of one ask
 * change 20–36% of the words, different asks 50% and more («ما مساحة دائرة نصف
 * قطرها #» / «محيط دائرة # ما طول نصف قطرها»). Inside the line sit a few pairs a
 * teacher might call two asks — the additive and the multiplicative inverse, an
 * interval written as an inequality and back — and those share a turn.
 *
 * A generator often writes one kind in several sentences (one per operation,
 * direction or number word). Spreading by frame alone served each sentence as
 * a kind of its own, so a kind written four ways filled four slots of every
 * paper before a one-sentence kind got a second (measured 2026-10-16: up to
 * ~60% of a paper). It can also lump two asks that share a long preamble
 * («… ما الوسيط؟» / «… ما المدى؟»); that only makes them share a kind's turn,
 * and `spreadScore` still spreads them by frame inside it.
 */
export function sameKind(a: string, b: string): boolean {
  if (a === b) return true;
  const x = a.split(' '), y = b.split(' ');
  return wordDistance(x, y) <= Math.max(1, Math.floor(0.37 * Math.max(x.length, y.length)));
}

/** The frames a pass has served, from the `ask:` keys a generator records in its `used` set. */
export function servedFrames(used: ReadonlySet<string>): Map<string, number> {
  const served = new Map<string, number>();
  for (const key of used) {
    if (!key.startsWith('ask:')) continue;
    const f = stemFrame(key.slice(4));
    served.set(f, (served.get(f) ?? 0) + 1);
  }
  return served;
}

/**
 * How much of a frame's kind a pass has already served — lower is fresher.
 * Kinds first, then the exact sentence, so a kind written several ways takes
 * its turn once and its sentences still rotate among themselves.
 *
 * The kind is everything linked to the frame through served sentences, since
 * `sameKind` is not transitive: «ضرب العدد # في #» and «طرح # من العدد #» are
 * each near «جمع العدد #» and not near each other.
 */
export function spreadScore(frame: string, served: ReadonlyMap<string, number>): number {
  const seen = new Set([frame]);
  const queue = [frame];
  let kind = 0;
  while (queue.length) {
    const at = queue.pop()!;
    for (const [f, n] of served) {
      if (seen.has(f) || !sameKind(at, f)) continue;
      seen.add(f);
      queue.push(f);
      kind += n;
    }
  }
  return (kind + (served.get(frame) ?? 0)) * 1000 + (served.get(frame) ?? 0);
}
