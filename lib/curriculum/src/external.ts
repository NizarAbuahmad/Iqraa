/**
 * Curated third-party material, attached to lessons.
 *
 * The NCCD books are the curriculum; this is everything else a lesson can
 * usefully point at — a public-domain listening passage with a transcript, a
 * simulation of the experiment the book only prints a diagram of, a NASA
 * photograph. Two things make it different from `G10_SOURCES` and are the
 * reason this is a separate manifest rather than more optional fields on
 * `CurriculumSource`:
 *
 *  1. **It keys to a lesson, not a unit tag.** A source is a whole book that
 *     covers a unit; a resource is one artefact that belongs to one or more
 *     specific lessons. `sources.ts` has no lesson-level anchor and its own
 *     comments explain why inventing one from a unit tag is a mistake.
 *
 *  2. **It carries a licence, and the licence is the whole point.** Every
 *     `CurriculumSource` came from one private Drive under a single blanket
 *     understanding, so `authority` was enough. Nothing here shares a
 *     provenance: a VOA transcript is public domain and reprintable, a PhET
 *     simulation may be shown and never copied, and the difference is a
 *     licence, not a pedigree. See `usePolicy` in `bank.ts`, which reads the
 *     `license` field these records carry.
 *
 * **`licenseCheckedAt` is not decoration.** PhET changed its simulation
 * licence on 2026-03-29; anything relying on a memory of "PhET is CC BY" is
 * relying on something that stopped being true. A licence is a fact with a
 * date on it, and a resource whose check has gone stale is refused by the
 * ingestion script rather than quietly re-uploaded.
 *
 * Metadata only — deliberately small, so this is safe to re-export from
 * `index.ts` and reach the mobile bundle. The bytes live in R2, and any
 * server-side reading of ingested *text* belongs behind its own subpath the
 * way `passages.ts` does, for the reason recorded there.
 */
import raw from './data/external_resources.json' with { type: 'json' };
import type { LicenseId } from './bank.ts';

/** What the resource is, which decides how a screen offers it. */
export type ExternalResourceKind =
  /** Prose meant to be read — a passage, an article, a transcript. */
  | 'text'
  /** Spoken audio. Paired with a `text` resource when it is a reading of one. */
  | 'audio'
  /** A photograph, diagram or infographic. */
  | 'image'
  /** An interactive simulation, shown in an iframe. Never copied. */
  | 'simulation'
  /** A video, shown in an iframe. Never copied. */
  | 'video';

/** Who published it. A closed set: each one's terms were read individually. */
export type ExternalProvider =
  | 'voa'
  | 'common-voice'
  | 'nasa'
  | 'wikimedia'
  | 'openstax'
  | 'phet'
  | 'youtube';

/**
 * A copy taken into our own R2 bucket.
 *
 * Present only on resources whose licence grants redistribution. Its absence
 * is meaningful and is what the ingestion script keys on: no `ingest` block
 * means the resource is pointed at, never fetched.
 */
export interface ExternalIngest {
  r2Key: string;
  sha256: string;
  bytes: number;
  /** ISO date. */
  ingestedAt: string;
}

export interface ExternalResource {
  /** Stable slug, e.g. `voa-le-plastic-oceans`. Referenced from question bodies. */
  id: string;
  /** `kbl-*` lesson ids. Ids, never titles — a title does not identify a lesson. */
  lessonIds: string[];
  kind: ExternalResourceKind;
  titleEn: string;
  titleAr: string;
  provider: ExternalProvider;
  license: LicenseId;
  licenseUrl: string;
  /** Canonical page for the original, which is also where a credit should link. */
  sourceUrl: string;
  /**
   * The asset itself, when it is not the page — an MP3, a JPEG, a PDF. What
   * `fetch-external.ts` downloads.
   *
   * Kept separate from `sourceUrl` rather than inferred, because inferring it
   * means scraping the article page for the media element, and a wrong guess
   * ingests the wrong bytes under a licence checked for something else. A
   * resource with no `fetchUrl` is not machine-ingestible: prose transcripts
   * are curated by hand for the same reason.
   */
  fetchUrl?: string;
  /** The credit, rendered verbatim wherever the resource appears. */
  attribution: string;
  /** ISO date the licence was last read. Staleness is refused, not warned about. */
  licenseCheckedAt: string;
  /**
   * Always `third-party` today, and named rather than assumed so `usePolicy`
   * can take these records and `CurriculumSource` through one structural
   * `Pick` instead of growing a second policy function.
   */
  authority: 'third-party';
  /** Word count for a `text` resource; seconds for `audio`/`video`. Sizing hints. */
  words?: number;
  durationSec?: number;
  /** CEFR band, where the provider states one. Not inferred. */
  level?: 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
  ingest?: ExternalIngest;
}

export const EXTERNAL_RESOURCES: ExternalResource[] = raw.resources as ExternalResource[];

/** Licences that permit taking a copy. Anything else is pointed at, never fetched. */
export const REDISTRIBUTABLE_LICENSES: readonly LicenseId[] = [
  'public-domain',
  'CC0-1.0',
  'CC-BY-4.0',
];

export function isRedistributable(r: Pick<ExternalResource, 'license'>): boolean {
  return REDISTRIBUTABLE_LICENSES.includes(r.license);
}

/**
 * How long a licence check stays good.
 *
 * Six months is a judgement, not a legal standard: long enough that re-checking
 * a stable catalogue is not busywork, short enough that a change like PhET's
 * surfaces within one curriculum cycle rather than at a teacher's export.
 */
export const LICENSE_CHECK_MAX_AGE_DAYS = 180;

export function licenseCheckAgeDays(r: Pick<ExternalResource, 'licenseCheckedAt'>, now = new Date()): number {
  const checked = Date.parse(`${r.licenseCheckedAt}T00:00:00Z`);
  if (Number.isNaN(checked)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - checked) / 86_400_000;
}

export function isLicenseCheckStale(r: Pick<ExternalResource, 'licenseCheckedAt'>, now = new Date()): boolean {
  return licenseCheckAgeDays(r, now) > LICENSE_CHECK_MAX_AGE_DAYS;
}

/** Every resource curated onto one lesson, in manifest order. */
export function externalResourcesForLesson(lessonId: string): ExternalResource[] {
  if (!lessonId) return [];
  return EXTERNAL_RESOURCES.filter(r => r.lessonIds.includes(lessonId));
}

export function getExternalResource(id: string): ExternalResource | undefined {
  return EXTERNAL_RESOURCES.find(r => r.id === id);
}

/**
 * Why this resource must not be copied into our own storage, or null if it may be.
 *
 * The licence decision, kept here with the rest of the licence model rather
 * than inside `fetch-external.ts`: a script that runs on demand is not where a
 * rule this consequential should live, and a rule nothing can import is a rule
 * nothing can test.
 *
 * Every branch states its reason as prose. A skipped resource with no stated
 * cause is indistinguishable from one nobody got to, and this text is what a
 * person reads to decide what to fix.
 */
export function ingestRefusal(r: ExternalResource, now = new Date()): string | null {
  if (!isRedistributable(r)) {
    return `${r.license} grants no redistribution right — point at it, do not copy it`;
  }
  if (isLicenseCheckStale(r, now)) {
    const age = licenseCheckAgeDays(r, now);
    const when = Number.isFinite(age) ? `${Math.round(age)} days ago` : 'unparseable date';
    return `licence last checked ${r.licenseCheckedAt} (${when}, limit ${LICENSE_CHECK_MAX_AGE_DAYS} days)`
      + ' — re-read the terms and update licenseCheckedAt';
  }
  if (!r.fetchUrl) {
    return 'no fetchUrl — the asset must be named explicitly, never inferred from the page';
  }
  if (!r.fetchUrl.startsWith('https://')) return `fetchUrl is not https: ${r.fetchUrl}`;
  return null;
}

/**
 * Structural problems that make a manifest entry unusable, as messages.
 *
 * Same posture as `validateCurriculum`: this reports, and the verify script
 * decides what is fatal. Licence staleness is deliberately NOT reported here —
 * it is a function of today's date, so it would make a pure data check fail on
 * a Tuesday for a file nobody edited. `fetch-external.ts` enforces it at the
 * point where it matters, which is before taking a copy.
 */
export function validateExternalResources(
  resources: readonly ExternalResource[] = EXTERNAL_RESOURCES,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const r of resources) {
    if (seen.has(r.id)) errors.push(`${r.id}: duplicate id`);
    seen.add(r.id);

    if (!r.lessonIds.length) errors.push(`${r.id}: attached to no lesson`);
    for (const id of r.lessonIds) {
      if (!id.startsWith('kbl-')) errors.push(`${r.id}: "${id}" is not a kbl-* lesson id`);
    }
    if (!r.attribution.trim()) {
      // Every licence here requires a credit, so a blank one is a breach
      // waiting to render rather than a cosmetic omission.
      errors.push(`${r.id}: no attribution text`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.licenseCheckedAt)) {
      errors.push(`${r.id}: licenseCheckedAt "${r.licenseCheckedAt}" is not an ISO date`);
    }
    if (!r.sourceUrl.startsWith('https://')) {
      errors.push(`${r.id}: sourceUrl must be https`);
    }
    if (r.ingest && !isRedistributable(r)) {
      // The dangerous direction: a copy taken under a licence that never
      // granted one. Worth failing the build over.
      errors.push(`${r.id}: has an ingest block but ${r.license} grants no redistribution right`);
    }
  }
  return errors;
}
