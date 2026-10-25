/**
 * Fixed-answer matcher for the public site Q&A bot.
 *
 * A visitor's question is first compared, with no AI involved, against a
 * reviewed list of fixed Arabic/English answers. Only a question that matches
 * none of them goes on to the AI path. This file is the matcher and nothing
 * else: it is pure and deterministic (no I/O, no logging, no imports), and the
 * list itself is passed in, so the answers can be reviewed and changed without
 * touching the algorithm.
 *
 * Three choices are deliberate, and all lean the same way — a wrong fixed
 * answer is worse than no fixed answer, because falling through to the AI path
 * only costs a slower reply:
 *
 *  - Dice on TOKEN SETS, not "contains". With a containment test, a long
 *    off-topic question that merely mentions the product («هل إقرأ أفضل من شات
 *    جي بي تي في كتابة الشعر») would hit the one-word phrase «إقرأ» and get the
 *    "what is Iqraa" answer. Dice divides by both sizes, so the same question
 *    scores about 0.2 against that phrase and falls through.
 *  - EXACT tokens after normalisation, no fuzzy matching and no stemming beyond
 *    the Arabic definite-article/preposition prefixes and the English plural.
 *    Edit distance would pair different words (سعر / شعر) and answer the wrong
 *    question; a miss merely reaches the AI.
 *  - A MARGIN between the best and second-best entry. A question that two
 *    entries both fit about equally is ambiguous, and picking one of them is a
 *    coin toss presented as an answer.
 *
 *  - A VOCABULARY VETO. Dice alone accepts a short question that has the shape
 *    of an entry but is about something else: «how much does chatgpt cost»
 *    shares "much" and "cost" with the price phrase and scores 0.8, «is iqraa
 *    not free» 0.8, «هل يوجد تطبيق ايفون» 0.667 against the Android entry. The
 *    margin cannot help, because it only guards a close SECOND entry. So the
 *    vocabulary is every token of every phrase of every entry, and a message
 *    containing any token outside it is refused outright: it mentions
 *    something no answer was written for, and that is the AI path's job.
 *
 * Spelling variants (hamza forms, ى/ي, ة/ه, diacritics, tatweel, Arabic-Indic
 * digits) are folded away in `normalizeText`, so a visitor's spelling does not
 * decide whether the review applies.
 */

export type CuratedEntry = { id: string; phrases: readonly string[]; ar: string; en: string };

export const MATCH_MIN_SCORE = 0.5;
export const MATCH_MIN_MARGIN = 0.15;

export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, c => String.fromCharCode(48 + (c.charCodeAt(0) & 0xf)))
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // "what's" is one word, not "what" and "s"; deleted before the non-letter step.
    .replace(/['\u2019]/g, "")
    .replace(/[^ء-يa-z0-9]+/g, " ")
    .trim();
}

// Already normalised: compared with tokens after `normalizeText`. The product
// name (اقرا / iqraa / iqra / iqrra) is deliberately absent — it carries the
// question.
const STOPWORDS: ReadonlySet<string> = new Set([
  // Arabic
  "هل", "ما", "ماذا", "كيف", "هو", "هي", "في", "من", "علي", "عن", "الي", "و", "او", "ان", "انا", "انت",
  "لي", "لك", "هذا", "هذه", "ذلك", "تلك", "كم", "اين", "متي", "لماذا", "يمكن", "يمكنني", "ممكن",
  "هناك", "عندكم", "لديكم", "فيه",
  // English
  "a", "an", "the", "is", "are", "was", "do", "does", "did", "can", "could", "i", "we", "you", "it",
  "to", "of", "for", "in", "on", "at", "and", "or", "how", "what", "whats", "who", "which", "there",
  "this", "that", "me", "my", "your", "with", "be", "about", "tell", "please",
]);

// Tried in this order; the first that fits (and leaves at least 2 letters) wins.
const ARABIC_PREFIXES: readonly string[] = ["وال", "بال", "كال", "فال", "ال", "لل"];

function stripPrefix(token: string): string {
  for (const prefix of ARABIC_PREFIXES) {
    if (token.startsWith(prefix) && token.length - prefix.length >= 2) {
      return token.slice(prefix.length);
    }
  }
  return token;
}

function stripPlural(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalizeText(input).split(" ")) {
    if (raw === "" || STOPWORDS.has(raw)) continue;
    const stripped = stripPrefix(raw);
    // «اللي» → «لي», «الان» → «ان»: a stopword behind a prefix is still a stopword.
    if (stripped !== raw && STOPWORDS.has(stripped)) continue;
    seen.add(stripPlural(stripped));
  }
  return Array.from(seen);
}

export function detectLanguage(input: string): "ar" | "en" {
  if (input === "") return "ar";
  return /(?=\p{Script=Arabic})\p{L}/u.test(input) ? "ar" : "en";
}

function dice(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared++;
  }
  return (2 * shared) / (a.size + b.size);
}

function scoreEntry(query: ReadonlySet<string>, entry: CuratedEntry): number {
  let best = 0;
  for (const phrase of entry.phrases) {
    const score = dice(query, new Set(tokenize(phrase)));
    if (score > best) best = score;
  }
  return best;
}

export function matchCurated(
  message: string,
  entries: readonly CuratedEntry[],
): { entry: CuratedEntry; score: number } | null {
  const tokens = tokenize(message);
  const query = new Set(tokens);
  if (query.size === 0 || entries.length === 0) return null;

  // Computed per call: the lists are tiny and a cache would be state.
  const vocabulary = new Set<string>();
  for (const entry of entries) {
    for (const phrase of entry.phrases) {
      for (const token of tokenize(phrase)) vocabulary.add(token);
    }
  }
  for (const token of tokens) {
    if (!vocabulary.has(token)) return null;
  }

  // Array.prototype.sort is stable, so equal scores keep entry order.
  const ranked = entries
    .map(entry => ({ entry, score: scoreEntry(query, entry) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]!;
  if (best.score < MATCH_MIN_SCORE) return null;
  const second = ranked[1];
  if (second && best.score - second.score < MATCH_MIN_MARGIN) return null;
  return best;
}

export function pickAnswer(entry: CuratedEntry, message: string): string {
  return entry[detectLanguage(message)];
}
