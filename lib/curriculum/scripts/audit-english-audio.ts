/**
 * Which English-corner recordings exist, and how they sound — with no keys at all.
 * Reads only the PUBLIC bucket URL the app plays from, and writes nothing but stdout.
 *
 *   pnpm --filter @workspace/curriculum run english-audio-audit [-- <flags>]
 *
 *   (none)             coverage: `HEAD` every clip in `audioPlan()`, print a table by
 *                      grade and source (needed / voiced / missing) with the register
 *   --missing          also list every missing recording with its text
 *   --deep             also download every present clip and measure it (needs ffmpeg):
 *                      minutes, leading and trailing silence, blank or near-silent
 *                      clips, the spread of speech levels, peaks, clips with no
 *                      trailing silence (possibly cut off) and bytes
 *   --fail-on-missing  exit 1 when anything is missing (for CI or a release check)
 *
 * `AUDIO_BASE_URL` overrides the base URL (a mirror, a local fixture server).
 *
 * The public r2.dev URL rate-limits hard (24 requests in parallel got a 429 on 43%
 * of them, 2026-10-24), so this runs 6 at a time and retries 429 and 5xx with
 * exponential backoff, honouring `Retry-After`. Node's `fetch` may ignore
 * `HTTPS_PROXY`; behind a proxy run it with `NODE_USE_ENV_PROXY=1`.
 */
import { audioPlan, type AudioItem } from '../src/englishAudioPlan.ts';
import { clipVerdict, type ClipStats } from '../src/englishAudioProcess.ts';

/**
 * Duplicated from `ENGLISH_AUDIO_BASE_URL` in `artifacts/mobile/services/englishAudio.ts`
 * (the app and this library do not share code); `englishAudioLocation.test.ts` pins the two equal.
 */
export const DEFAULT_AUDIO_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio';

const BASE = (process.env.AUDIO_BASE_URL || DEFAULT_AUDIO_BASE_URL).replace(/\/+$/, '');
const CONCURRENCY = 6;
const MAX_ATTEMPTS = 8;

const listMissing = process.argv.includes('--missing');
const deep = process.argv.includes('--deep');
const failOnMissing = process.argv.includes('--fail-on-missing');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The longest `Retry-After` honoured: a server asking for an hour should not hang the audit for one. */
const MAX_RETRY_AFTER_MS = 60_000;

/** `Retry-After` as milliseconds (delta-seconds or an HTTP date), capped at `MAX_RETRY_AFTER_MS`. */
function retryAfterMs(header: string | null): number {
  if (!header) return 0;
  const s = Number(header);
  const t = Date.parse(header);
  const ms = Number.isFinite(s) ? s * 1000 : Number.isFinite(t) ? t - Date.now() : 0;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, ms));
}

/** 0.5 s, 1 s, 2 s … capped at 30 s, plus a little jitter so six workers do not retry in step. */
function backoffMs(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

async function request(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, { method });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS - 1) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS - 1) {
      await res.body?.cancel();
      await sleep(Math.max(retryAfterMs(res.headers.get('retry-after')), backoffMs(attempt)));
      continue;
    }
    return res;
  }
}

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        if (++done % 500 === 0) console.error(`  ${done}/${items.length}`);
      }
    }),
  );
  return out;
}

type Presence = { item: AudioItem; state: 'voiced' | 'missing' | 'error'; bytes: number; status: number };

async function head(item: AudioItem): Promise<Presence> {
  try {
    const res = await request(`${BASE}/${item.slug}.mp3`, 'HEAD');
    const bytes = Number(res.headers.get('content-length') ?? 0);
    if (res.ok) return { item, state: 'voiced', bytes, status: res.status };
    return { item, state: res.status === 404 ? 'missing' : 'error', bytes: 0, status: res.status };
  } catch {
    return { item, state: 'error', bytes: 0, status: 0 };
  }
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n);
}

const plan = audioPlan();
console.log(`audio plan: ${plan.length} recordings — checking ${BASE}/`);
const presence = await pool(plan, head);

// ─── Coverage ─────────────────────────────────────────────────────────────
// A recording used by two grades counts in both rows; the total row counts it once.
type Row = { needed: number; voiced: number; missing: number; error: number; young: number; teen: number };
const rows = new Map<string, Row>();
const bump = (key: string, p: Presence) => {
  let r = rows.get(key);
  if (!r) rows.set(key, (r = { needed: 0, voiced: 0, missing: 0, error: 0, young: 0, teen: 0 }));
  r.needed += 1;
  r[p.state] += 1;
  r[p.item.register] += 1;
};
for (const p of presence) for (const g of p.item.grades) bump(`${g}\t${p.item.source}`, p);
const total: Row = { needed: 0, voiced: 0, missing: 0, error: 0, young: 0, teen: 0 };
for (const p of presence) {
  total.needed += 1;
  total[p.state] += 1;
  total[p.item.register] += 1;
}

console.log('');
console.log('grade  source    needed  voiced  missing  errors   young   teen');
const keys = [...rows.keys()].sort((a, b) => {
  const [ga, sa] = a.split('\t');
  const [gb, sb] = b.split('\t');
  return Number(ga) - Number(gb) || sa.localeCompare(sb);
});
for (const k of keys) {
  const [g, s] = k.split('\t');
  const r = rows.get(k)!;
  console.log(`${pad(g, 5)}  ${s.padEnd(8)}${pad(r.needed, 8)}${pad(r.voiced, 8)}${pad(r.missing, 9)}${pad(r.error, 8)}${pad(r.young, 8)}${pad(r.teen, 7)}`);
}
console.log(`total  (distinct)${pad(total.needed, 7)}${pad(total.voiced, 8)}${pad(total.missing, 9)}${pad(total.error, 8)}${pad(total.young, 8)}${pad(total.teen, 7)}`);
const errors = presence.filter(p => p.state === 'error');
if (errors.length) {
  const by = new Map<number, number>();
  for (const e of errors) by.set(e.status, (by.get(e.status) ?? 0) + 1);
  console.log(`\n${errors.length} could not be checked (HTTP ${[...by].map(([s, n]) => `${s || 'network'}×${n}`).join(', ')}) — counted neither voiced nor missing; re-run.`);
}

if (listMissing) {
  const missing = presence.filter(p => p.state === 'missing');
  console.log(`\nmissing (${missing.length}):`);
  for (const p of missing) {
    console.log(`  G${p.item.grades.join('/')}  ${p.item.source.padEnd(7)} ${p.item.register.padEnd(5)}  ${p.item.slug}.mp3  ←  ${p.item.text}`);
  }
}

// ─── Deep: download and measure ───────────────────────────────────────────

const median = (a: number[]) => quantile(a, 0.5);
function quantile(a: number[], q: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const f2 = (n: number) => n.toFixed(2);
const f1 = (n: number) => n.toFixed(1);

if (deep) {
  const { assertFfmpeg, measureClip } = await import('./audioFfmpeg.ts');
  try {
    assertFfmpeg();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
  }
  const present = presence.filter(p => p.state === 'voiced');
  console.log(`\nmeasuring ${present.length} clips …`);
  type Measured = { slug: string; bytes: number; stats: ClipStats } | { slug: string; error: string };
  const measured: Measured[] = await pool(present, async p => {
    try {
      const res = await request(`${BASE}/${p.item.slug}.mp3`, 'GET');
      if (!res.ok) return { slug: p.item.slug, error: `HTTP ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      return { slug: p.item.slug, bytes: buf.length, stats: await measureClip(buf) };
    } catch (err) {
      return { slug: p.item.slug, error: (err as Error).message.slice(0, 120) };
    }
  });
  const ok = measured.filter((m): m is { slug: string; bytes: number; stats: ClipStats } => 'stats' in m);
  const bad = measured.filter((m): m is { slug: string; error: string } => 'error' in m);
  const st = ok.map(m => m.stats);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const lead = st.map(s => s.leadS);
  const trail = st.map(s => s.trailS);
  const totalS = sum(st.map(s => s.durationS));
  const speechS = sum(st.map(s => s.speechS));
  console.log(`  ${ok.length} measured${bad.length ? `, ${bad.length} could not be read (${bad.slice(0, 5).map(b => `${b.slug}: ${b.error}`).join('; ')})` : ''}`);
  console.log(
    `  total ${f1(totalS / 60)} min, of which ${f1((totalS - speechS) / 60)} min outside the speech spans ` +
      `(leading ${f1(sum(lead) / 60)}, trailing ${f1(sum(trail) / 60)})`,
  );
  console.log(`  leading silence:  median ${f2(median(lead))} s, ${lead.filter(x => x > 1).length} over 1.0 s, ${lead.filter(x => x > 0.5).length} over 0.5 s, max ${f2(Math.max(...lead))} s`);
  console.log(`  trailing silence: median ${f2(median(trail))} s, ${trail.filter(x => x > 1).length} over 1.0 s, ${trail.filter(x => x > 0.5).length} over 0.5 s, max ${f2(Math.max(...trail))} s`);
  const rejects = ok.map(m => ({ m, v: clipVerdict(m.stats) })).filter(x => !x.v.ok);
  const quiet = ok.filter(m => clipVerdict(m.stats).ok && m.stats.meanDb < -40);
  console.log(`  blank or near-silent: ${rejects.length + quiet.length}` +
    [...rejects.map(x => ` ${x.m.slug} (${(x.v as { reason: string }).reason}, peak ${f1(x.m.stats.maxDb)} dBFS)`),
      ...quiet.map(m => ` ${m.slug} (speech level ${f1(m.stats.meanDb)} dBFS)`)].join(','));
  const spoken = ok.filter(m => m.stats.speechS > 0);
  if (spoken.length) {
    const lv = spoken.map(m => m.stats.meanDb);
    const lo = spoken.reduce((a, b) => (b.stats.meanDb < a.stats.meanDb ? b : a));
    const hi = spoken.reduce((a, b) => (b.stats.meanDb > a.stats.meanDb ? b : a));
    console.log(`  speech level (dBFS): p5 ${f1(quantile(lv, 0.05))}, median ${f1(median(lv))}, p95 ${f1(quantile(lv, 0.95))}, min ${f1(lo.stats.meanDb)} (${lo.slug}), max ${f1(hi.stats.meanDb)} (${hi.slug})`);
  }
  const hot = ok.filter(m => m.stats.maxDb > -0.5);
  console.log(`  peak above −0.5 dBFS: ${hot.length}${hot.length ? ` (${hot.slice(0, 10).map(m => m.slug).join(', ')})` : ''}`);
  const cut = ok.filter(m => m.stats.speechS > 0 && m.stats.trailS < 0.02);
  console.log(`  no trailing silence (possibly cut off): ${cut.length}${cut.length ? ` (${cut.slice(0, 20).map(m => m.slug).join(', ')})` : ''}`);
  const bytes = ok.map(m => m.bytes);
  console.log(`  bytes: ${f1(sum(bytes) / 1048576)} MB, median ${f1(median(bytes) / 1024)} KB, max ${f1(Math.max(...bytes) / 1024)} KB`);
}

if (failOnMissing && total.missing + total.error > 0) process.exitCode = 1;
