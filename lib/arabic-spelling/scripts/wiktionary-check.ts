/**
 * Cross-checks the hand-authored spelling bank against Arabic Wiktionary.
 *
 * Wiktionary is community-edited, so it is a second opinion, never a source:
 * the bank stays the key (see the header of `src/rules.ts`). This only reports.
 *
 *   missing        `correct` has no Arabic entry under its bare or vowelled
 *                  title — a typo in the bank, or an inflected/rare form
 *                  Wiktionary does not list. Most findings are the latter.
 *   unvowelled     entry exists but the page never shows our harakat — the
 *                  vowelling may differ from the book's, worth a glance.
 *   wrong-is-entry a `wrong` spelling has its own *Arabic* entry — the distractor
 *                  may be a real word, so a child's "mistake" would be correct.
 *                  Persian and Egyptian-dialect pages share the letters (مدرسه
 *                  is Persian) and are ignored.
 *
 * Nothing from Wiktionary is stored or shown to users, so no CC BY-SA
 * attribution is triggered. Showing definitions in the app would need it.
 *
 * Run: pnpm --filter @workspace/arabic-spelling exec node --experimental-strip-types scripts/wiktionary-check.ts [--grade N]
 */
import { SPELLING_RULES } from "../src/index.ts";

const API = "https://ar.wiktionary.org/w/api.php";
// Wikimedia asks automated clients to identify themselves.
const UA = "IqrraSpellingCheck/0.1 (dev tool; nizar.abuahmad@gmail.com)";
const BATCH = 50; // MediaWiki's per-request title cap for anonymous clients.

const HARAKAT = /[ً-ْٰـ]/g;
const bare = (s: string) => s.normalize("NFKC").replace(HARAKAT, "");
const withHarakat = (s: string) => s.normalize("NFKC").replace(/ـ/g, "");
// Wiktionary lists «شمس», never «الشمس». The sun-letter shadda goes with the article.
const stemOf = (s: string) => bare(s).replace(/^ال(?=.{2})/, "");
// ar.wiktionary files every language under one title; only this section is Arabic.
const isMisspelling = (wikitext: string) => /\{\{خطأ إملائي\|/.test(wikitext);
const isArabic = (wikitext: string) => /\{\{اللغة\|عربية\}\}/.test(wikitext);

async function lookup(titles: string[]): Promise<Map<string, string | null>> {
  const found = new Map<string, string | null>(); // title -> wikitext, null = no page
  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH);
    const url = `${API}?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(chunk.join("|"))}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Wiktionary ${res.status} on batch ${i / BATCH}`);
    const q = (await res.json()).query;
    // A redirect (e.g. unvowelled -> canonical title) must map back to what we asked for.
    const redirect = new Map<string, string>();
    for (const r of q.redirects ?? []) redirect.set(r.to, r.from);
    for (const n of q.normalized ?? []) redirect.set(n.to, n.from);
    for (const p of q.pages) {
      const asked = redirect.get(p.title) ?? p.title;
      found.set(asked, p.missing ? null : (p.revisions?.[0]?.slots?.main?.content ?? ""));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return found;
}

const gradeArg = process.argv.indexOf("--grade");
const grade = gradeArg > 0 ? Number(process.argv[gradeArg + 1]) : Infinity;

const words = SPELLING_RULES.flatMap((r) =>
  r.words.filter((w) => w.grade <= grade).map((w) => ({ rule: r.id, ...w })),
);
// Arabic entries are often titled with their harakat, so ask for both forms.
const titles = [
  ...new Set(words.flatMap((w) => [bare(w.correct), withHarakat(w.correct), stemOf(w.correct), ...w.wrong.map(bare)])),
];
const pages = await lookup(titles);

const arabicPage = (title: string) => {
  const page = pages.get(title);
  return page && isArabic(page) ? page : null;
};

const issues: string[] = [];
let ok = 0;
let misspellingsConfirmed = 0;
for (const w of words) {
  const stemmed = stemOf(w.correct) !== bare(w.correct);
  const page = arabicPage(withHarakat(w.correct)) ?? arabicPage(bare(w.correct)) ?? arabicPage(stemOf(w.correct));
  if (!page) {
    issues.push(`missing         ${w.rule}  ${w.correct}`);
  } else if (!stemmed && !page.normalize("NFKC").includes(withHarakat(w.correct))) {
    // A «ال» word is matched on its stem, whose vowelling we cannot compare.
    issues.push(`unvowelled      ${w.rule}  ${w.correct}`);
  } else ok++;
  for (const x of w.wrong) {
    // `wrong` and `correct` can bare-fold to the same title; that is not a finding.
    const entry = bare(x) !== bare(w.correct) ? arabicPage(bare(x)) : null;
    if (!entry) continue;
    if (isMisspelling(entry)) misspellingsConfirmed++;
    else issues.push(`wrong-is-entry  ${w.rule}  ${x}  (for ${w.correct})`);
  }
}

console.log(
  `${words.length} words, ${titles.length} titles looked up, ${ok} fully confirmed, ` +
    `${misspellingsConfirmed} distractors confirmed by Wiktionary as common misspellings`,
);
console.log(issues.length ? issues.join("\n") : "no issues");
