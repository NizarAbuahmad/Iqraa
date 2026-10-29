/**
 * The facts the public bot answers from: iqrra.com's own llms.txt.
 *
 * Fetched, not copied. The site build regenerates that file from the same
 * curriculum snapshot as its /manhaj pages, so the bot cannot drift from the
 * site, and no coverage number is hard-coded in this repo. If it cannot be
 * fetched the bot uses a short built-in block with no numbers in it.
 *
 * Never throws. A fetch that fails costs the bot its freshness, never the
 * visitor an answer — and a failure is remembered for a minute, not retried on
 * every request, so an outage on the site does not turn into a request storm
 * from here.
 *
 * Oversize text is CUT, not refused. Refusing would silently drop the bot to
 * its fallback the day the blog list grows past a limit, and nobody would see
 * it happen; the top of the file is where the facts are.
 */
import { logger } from "./logger.ts";
import { SITE_ASK_FALLBACK_FACTS } from "./siteAskPrompts.ts";

export const SITE_FACTS_URL = "https://www.iqrra.com/llms.txt";
export const SITE_FACTS_TTL_MS = 60 * 60 * 1000;
export const SITE_FACTS_RETRY_MS = 60 * 1000;
export const SITE_FACTS_TIMEOUT_MS = 5_000;
export const SITE_FACTS_MAX_CHARS = 24_000;
/** A response that declares more than this is not a text file we wrote. */
const SITE_FACTS_MAX_DECLARED_BYTES = 200_000;

export type SiteFacts = { text: string; source: "site" | "fallback" };
type Deps = { fetchImpl?: typeof fetch; now?: () => number };

let cached: { facts: SiteFacts; expiresAt: number } | null = null;
let inflight: Promise<SiteFacts> | null = null;

/** Tests only: the cache is module state. */
export function resetSiteFactsCache(): void {
  cached = null;
  inflight = null;
}

async function fetchSiteText(fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(SITE_FACTS_URL, {
      signal: AbortSignal.timeout(SITE_FACTS_TIMEOUT_MS),
      headers: { accept: "text/plain" },
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "site facts: llms.txt not available");
      return null;
    }
    // A 200 that is a web page (an error page, a login wall) must not become the
    // facts for an hour. No header at all is accepted, as before.
    const type = res.headers.get("content-type");
    if (type !== null && !/^\s*text\/(plain|markdown)/i.test(type)) {
      logger.warn({ type }, "site facts: llms.txt is not a text file");
      return null;
    }
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > SITE_FACTS_MAX_DECLARED_BYTES) {
      logger.warn({ declared }, "site facts: llms.txt declares an implausible size");
      return null;
    }
    const text = (await res.text()).trim();
    if (!text) {
      logger.warn("site facts: llms.txt is empty");
      return null;
    }
    if (text.length > SITE_FACTS_MAX_CHARS) {
      logger.warn({ length: text.length, kept: SITE_FACTS_MAX_CHARS }, "site facts: llms.txt cut to the cap");
      return text.slice(0, SITE_FACTS_MAX_CHARS);
    }
    return text;
  } catch (err) {
    logger.warn({ err }, "site facts: fetch failed");
    return null;
  }
}

export async function loadSiteFacts(deps: Deps = {}): Promise<SiteFacts> {
  const now = deps.now ?? Date.now;
  if (cached && cached.expiresAt > now()) return cached.facts;
  if (inflight) return inflight;

  const fetchImpl = deps.fetchImpl ?? fetch;
  inflight = (async () => {
    const text = await fetchSiteText(fetchImpl);
    const facts: SiteFacts = text
      ? { text, source: "site" }
      : { text: SITE_ASK_FALLBACK_FACTS, source: "fallback" };
    cached = { facts, expiresAt: now() + (text ? SITE_FACTS_TTL_MS : SITE_FACTS_RETRY_MS) };
    return facts;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
