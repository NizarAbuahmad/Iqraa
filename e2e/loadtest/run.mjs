#!/usr/bin/env node
/**
 * Load test for the launch-day paths: a sign-up and sign-in rush, then classes
 * of students sitting a published exam while teachers watch.
 *
 *   LOADTEST_DATABASE_URL=<throwaway> node loadtest/run.mjs --api http://localhost:8099/api
 *
 * It drives the real HTTP API (no browser), so it measures the server and the
 * database, not React. Read e2e/loadtest/README.md before pointing it anywhere.
 *
 * Safety: it creates users, classes and exams, truncates `rate_limit_buckets`,
 * and plants email-verification codes straight into Postgres (the real code is
 * only ever emailed). It therefore needs the DATABASE of the API it is testing,
 * and refuses hosts that look like production.
 */
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import pg from "pg";

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const num = (name, fallback) => {
  const v = Number(flag(name, fallback));
  if (!Number.isFinite(v) || v < 0) die(`--${name} must be a non-negative number`);
  return v;
};

if (flag("help", false)) {
  console.log(`Options (defaults in brackets)
  --api <url>            API base incl. /api            [http://localhost:8099/api]
  --signups <n>          accounts registered + verified + signed in [100]
  --classes <n>          classes, each with its own teacher and exam  [3]
  --students <n>         students per class, all sitting the exam     [40]
  --ramp-s <n>           spread student arrivals over this many seconds [10]
  --think-ms <n>         pause between a student's answers             [0]
  --questions <n>        questions per exam                            [10]
  --admin-key <key>      ADMIN_DEBUG_KEY: sample /healthz/pool each second
  --spoof-ip <bool>      give each virtual user its own X-Forwarded-For
                         (only works with no proxy in front; default: localhost only)
  --max-error-rate <f>   exit 1 above this 5xx+network rate            [0.01]
  --max-p95-ms <n>       exit 1 if any measured route's p95 exceeds this [off]
  --json <path>          also write the full results here
  --skip <list>          comma list of: signup, login, exam
  --allow-remote         permit a non-local API host (a staging service you own)`);
  process.exit(0);
}

const API = String(flag("api", "http://localhost:8099/api")).replace(/\/$/, "");
const DB_URL = process.env.LOADTEST_DATABASE_URL ?? process.env.E2E_DATABASE_URL;
const SIGNUPS = num("signups", 100);
const CLASSES = num("classes", 3);
const STUDENTS = num("students", 40);
const RAMP_S = num("ramp-s", 10);
const THINK_MS = num("think-ms", 0);
const QUESTIONS = num("questions", 10);
const ADMIN_KEY = flag("admin-key", process.env.ADMIN_DEBUG_KEY ?? "");
const MAX_ERROR_RATE = num("max-error-rate", 0.01);
const MAX_P95 = flag("max-p95-ms", false) === false ? null : num("max-p95-ms", 0);
const SKIP = new Set(String(flag("skip", "")).split(",").filter(Boolean));

const host = new URL(API).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
const SPOOF = flag("spoof-ip", isLocal) === true || flag("spoof-ip", isLocal) === "true";

function die(msg) {
  console.error(`loadtest: ${msg}`);
  process.exit(2);
}

if (!DB_URL) die("set LOADTEST_DATABASE_URL (or E2E_DATABASE_URL) to the THROWAWAY database behind the API under test");
if (/(run\.app|iqrra\.com|iqraa\.app)$/i.test(host)) die(`${host} looks like production — this test writes users and wipes rate limits. Refusing.`);
if (!isLocal && !flag("allow-remote", false)) die(`${host} is not local; pass --allow-remote if it is a staging service you own`);
if (/neon\.tech/i.test(DB_URL) && !flag("allow-remote", false)) die("database is on neon.tech; pass --allow-remote to confirm it is a throwaway branch");

// ----------------------------------------------------------------- measuring

/** label -> { ms: number[], status: Map<string|number, number> } */
const stats = new Map();
let phaseName = "setup";
const phases = []; // { name, startedAt, endedAt }

function record(label, ms, status) {
  if (phaseName === "setup") return;
  const key = `${phaseName} · ${label}`;
  let s = stats.get(key);
  if (!s) stats.set(key, (s = { phase: phaseName, ms: [], status: new Map() }));
  s.ms.push(ms);
  s.status.set(status, (s.status.get(status) ?? 0) + 1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ipCounter = 0;
const nextIp = () => {
  const n = ++ipCounter;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
};

/** One HTTP call. Never throws: a network failure is a status of "net". */
async function call(label, method, path, { token, body, ip, expect } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  if (SPOOF && ip) headers["x-forwarded-for"] = ip;
  const t0 = performance.now();
  let status = "net";
  let json = null;
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    status = res.status;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
  } catch (err) {
    status = err?.name === "TimeoutError" ? "timeout" : "net";
  }
  const ms = performance.now() - t0;
  record(label, ms, status);
  if (expect !== undefined && status !== expect) {
    const detail = json?.error ?? json?.code ?? "";
    return { ok: false, status, json, ms, detail };
  }
  return { ok: typeof status === "number" && status < 400, status, json, ms, detail: json?.error ?? "" };
}

function must(r, what) {
  if (!r.ok) die(`setup failed at "${what}": HTTP ${r.status} ${r.detail}`);
  return r.json;
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);

// ---------------------------------------------------------------- database

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const codeHash = (code) => createHash("sha256").update(code).digest("hex");
const CODE = "123456";

/** Plants a known verification code for each address (the real one is only emailed). */
async function plantCodes(emails) {
  if (emails.length === 0) return;
  await db.query(
    `insert into email_verification_tokens (user_id, code_hash, expires_at)
     select id, $2, now() + interval '30 minutes' from users where lower(email) = any($1::text[])`,
    [emails.map((e) => e.toLowerCase()), codeHash(CODE)],
  );
}

// -------------------------------------------------------- bystander probe

/**
 * A cheap request that needs no database (`/healthz`), sent every 250 ms for the
 * whole run. If it slows down while sign-ups are hashing passwords, the Node
 * event loop is starved and *every* user of that instance feels it — including
 * a class mid-exam — which no per-route latency in this report would show.
 */
let bystanderTimer = null;
function startBystander() {
  bystanderTimer = setInterval(() => {
    if (phaseName !== "setup") void call("bystander GET /healthz (no db)", "GET", "/healthz", {});
  }, 250);
}

// -------------------------------------------------------- pool sampling

const poolSamples = [];
let poolTimer = null;
function startPoolSampling() {
  if (!ADMIN_KEY || ADMIN_KEY === true) return;
  poolTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/healthz/pool`, { headers: { "x-admin-key": String(ADMIN_KEY) }, signal: AbortSignal.timeout(5000) });
      if (res.ok) poolSamples.push({ t: Date.now(), phase: phaseName, ...(await res.json()) });
    } catch {
      /* a sample is a convenience; the run goes on */
    }
  }, 1000);
}

// ------------------------------------------------------------------ scenarios

const PASSWORD = "Load-Test-Pass-2026!";
const runId = randomBytes(3).toString("hex");
const emailOf = (kind, i) => `lt-${runId}-${kind}-${i}@example.com`;

async function register(label, email, ip) {
  return call(label, "POST", "/auth/register", {
    ip,
    body: { firstName: "Load", lastName: `Test${email.split("-")[3]}`, email, password: PASSWORD, confirmPassword: PASSWORD, acceptedTerms: true, termsVersion: "2026-01-01" },
  });
}

/** Run `n` jobs with at most `limit` in flight (limit 0 = all at once). */
async function pool(n, limit, job) {
  const results = new Array(n);
  let next = 0;
  const workers = Array.from({ length: limit > 0 ? Math.min(limit, n) : n }, async () => {
    while (next < n) {
      const i = next++;
      results[i] = await job(i);
    }
  });
  await Promise.all(workers);
  return results;
}

function beginPhase(name) {
  phaseName = name;
  phases.push({ name, startedAt: performance.now(), endedAt: 0 });
}
function endPhase() {
  const p = phases[phases.length - 1];
  if (p) p.endedAt = performance.now();
  phaseName = "setup";
}

// --- 1. Sign-up rush: everyone registers at once, verifies, then signs in.

async function signupAndLoginPhase() {
  const emails = Array.from({ length: SIGNUPS }, (_, i) => emailOf("su", i));
  const ips = emails.map(nextIp);

  console.log(`\n▶ sign-up: ${SIGNUPS} accounts registering at once`);
  beginPhase("signup");
  await pool(SIGNUPS, 0, (i) => register("POST /auth/register", emails[i], ips[i]));
  endPhase();

  await plantCodes(emails);

  console.log(`▶ verify: ${SIGNUPS} accounts entering their code`);
  beginPhase("verify");
  await pool(SIGNUPS, 0, (i) => call("POST /auth/verify-email", "POST", "/auth/verify-email", { ip: ips[i], body: { email: emails[i], code: CODE } }));
  endPhase();

  if (SKIP.has("login")) return;
  console.log(`▶ sign-in: ${SIGNUPS} accounts logging in at once (bcrypt cost 12)`);
  beginPhase("login");
  await pool(SIGNUPS, 0, (i) => call("POST /auth/login", "POST", "/auth/login", { ip: ips[i], body: { email: emails[i], password: PASSWORD } }));
  endPhase();
}

// --- 2. Classes of students sitting an exam, teachers watching.

const BOOK = "book-math-10";
const OBJECTIVES = ["o-nccd-s1-u1_l1-0", "o-nccd-s1-u1_l1-1"];

async function setUpClass(c) {
  const email = emailOf("tc", c);
  const ip = nextIp();
  must(await register("setup", email, ip), "register teacher");
  await plantCodes([email]);
  const v = must(await call("setup", "POST", "/auth/verify-email", { ip, body: { email, code: CODE } }), "verify teacher");
  const token = v.accessToken;
  must(await call("setup", "POST", "/auth/roster-consent", { token, ip, body: {} }), "roster consent");
  const cls = must(await call("setup", "POST", "/classes", { token, ip, body: { name: `Load class ${c}`, gradeId: "grade-10" } }), "create class");
  const classId = cls.class.id;
  const names = Array.from({ length: STUDENTS }, (_, i) => ({ displayName: `Student ${c}-${i}` }));
  for (let at = 0; at < names.length; at += 150) {
    must(await call("setup", "POST", `/classes/${classId}/students`, { token, ip, body: { students: names.slice(at, at + 150) } }), "add students");
  }
  const ev = must(
    await call("setup", "POST", "/evaluations", {
      token,
      ip,
      body: { bookId: BOOK, objectiveIds: OBJECTIVES, assessmentTypes: ["multiple_choice"], targetQuestionCount: QUESTIONS, title: `Load exam ${c}`, titleAr: `اختبار ${c}`, language: "ar" },
    }),
    "create evaluation",
  );
  const evaluationId = ev.evaluation.id;
  must(await call("setup", "POST", `/evaluations/${evaluationId}/generate`, { token, ip, body: {} }), "generate questions");
  const pub = must(await call("setup", "POST", `/evaluations/${evaluationId}/publish`, { token, ip, body: {} }), "publish");
  must(await call("setup", "PATCH", `/evaluations/${evaluationId}`, { token, ip, body: { classGroupId: classId } }), "attach to class");
  const code = pub.evaluation.shareCode;
  if (!code) die("publish returned no shareCode");
  const roster = must(await call("setup", "GET", `/take/${code}`, { ip }), "open link");
  return { token, ip, classId, evaluationId, code, studentIds: roster.students.map((s) => s.id) };
}

async function studentSits(cls, idx, delayMs) {
  const ip = nextIp();
  await sleep(delayMs);
  const open = await call("GET /take/:code", "GET", `/take/${cls.code}`, { ip });
  if (!open.ok) return "open";
  const claim = await call("POST /take/:code/claim", "POST", `/take/${cls.code}/claim`, { ip, body: { studentId: cls.studentIds[idx] } });
  if (!claim.ok) return "claim";
  const token = claim.json?.token;
  const state = await call("GET /take/attempt/state", "GET", "/take/attempt/state", { token, ip });
  if (!state.ok) return "state";
  for (const q of state.json.questions ?? []) {
    if (THINK_MS) await sleep(THINK_MS * (0.5 + Math.random()));
    const optionId = q.options?.[0]?.id;
    const r = await call("PUT /take/attempt/answers/:q", "PUT", `/take/attempt/answers/${q.id}`, {
      token,
      ip,
      body: { response: optionId ? { optionIds: [optionId] } : { text: "x" } },
    });
    if (!r.ok) return "answer";
  }
  const sub = await call("POST /take/attempt/submit", "POST", "/take/attempt/submit", { token, ip, body: {} });
  if (!sub.ok) return "submit";
  await call("GET /take/attempt/result", "GET", "/take/attempt/result", { token, ip });
  return "ok";
}

async function examPhase() {
  console.log(`\n▶ exam setup: ${CLASSES} teachers, ${STUDENTS} students each`);
  const classes = [];
  for (let c = 0; c < CLASSES; c++) classes.push(await setUpClass(c)); // serial: setup is not what we measure

  const total = CLASSES * STUDENTS;
  console.log(`▶ exam: ${total} students sitting (${RAMP_S}s ramp, ${QUESTIONS} questions each)`);
  beginPhase("exam");
  const t0 = performance.now();
  let watching = true;
  const watchers = classes.map(async (cls) => {
    while (watching) {
      await call("GET /evaluations/:id/attempts (teacher)", "GET", `/evaluations/${cls.evaluationId}/attempts`, { token: cls.token, ip: cls.ip });
      await call("GET /classes/:id (teacher)", "GET", `/classes/${cls.classId}`, { token: cls.token, ip: cls.ip });
      await sleep(2000);
    }
  });
  const outcomes = [];
  await Promise.all(
    classes.flatMap((cls, c) =>
      Array.from({ length: STUDENTS }, (_, i) =>
        studentSits(cls, i, RAMP_S ? Math.random() * RAMP_S * 1000 : 0).then((o) => outcomes.push(o)),
      ),
    ),
  );
  watching = false;
  await Promise.all(watchers);
  const wall = (performance.now() - t0) / 1000;
  endPhase();

  const tally = outcomes.reduce((m, o) => m.set(o, (m.get(o) ?? 0) + 1), new Map());
  const done = tally.get("ok") ?? 0;
  console.log(`  ${done}/${total} students handed in in ${wall.toFixed(1)}s` + (done < total ? `  — stopped at: ${[...tally].filter(([k]) => k !== "ok").map(([k, v]) => `${k}×${v}`).join(", ")}` : ""));

  // Did the server really end up with a submission per student? "200" is not the same thing.
  const { rows } = await db.query(
    "select count(*)::int as n from attempts where evaluation_id = any($1::uuid[]) and submitted_at is not null",
    [classes.map((c) => c.evaluationId)],
  );
  console.log(`  database holds ${rows[0].n} submitted attempts (expected ${done})`);
  return { total, done, wall, stored: rows[0].n, tally: Object.fromEntries(tally) };
}

// ----------------------------------------------------------------- run + report

// Limits live in Postgres and outlast a run; a second run from the same box would be refused.
await db.query("truncate rate_limit_buckets");
startPoolSampling();
startBystander();

let examResult = null;
const startedAt = new Date().toISOString();
if (!SKIP.has("signup") && SIGNUPS > 0) await signupAndLoginPhase();
if (!SKIP.has("exam") && CLASSES > 0 && STUDENTS > 0) examResult = await examPhase();
if (poolTimer) clearInterval(poolTimer);
if (bystanderTimer) clearInterval(bystanderTimer);

const rows = [...stats.entries()].map(([key, s]) => {
  const sorted = [...s.ms].sort((a, b) => a - b);
  const statuses = Object.fromEntries([...s.status].sort(([a], [b]) => String(a).localeCompare(String(b))));
  const bad = [...s.status].filter(([k]) => typeof k !== "number" || k >= 500).reduce((n, [, v]) => n + v, 0);
  return { key, phase: s.phase, n: s.ms.length, p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99), max: sorted.at(-1) ?? 0, statuses, bad };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad("route", 52)}${pad("n", 7)}${pad("p50", 9)}${pad("p95", 9)}${pad("p99", 9)}${pad("max", 9)}status`);
for (const r of rows) {
  const st = Object.entries(r.statuses).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(`${pad(r.key, 52)}${pad(r.n, 7)}${pad(r.p50.toFixed(0), 9)}${pad(r.p95.toFixed(0), 9)}${pad(r.p99.toFixed(0), 9)}${pad(r.max.toFixed(0), 9)}${st}`);
}

if (poolSamples.length) {
  const byPhase = new Map();
  for (const s of poolSamples) {
    const cur = byPhase.get(s.phase) ?? { maxWaiting: 0, maxTotal: 0, samples: 0 };
    cur.maxWaiting = Math.max(cur.maxWaiting, s.app.waiting);
    cur.maxTotal = Math.max(cur.maxTotal, s.app.total);
    cur.samples++;
    byPhase.set(s.phase, cur);
  }
  console.log("\ndb pool (one instance, sampled each second)");
  for (const [phase, v] of byPhase) console.log(`  ${pad(phase, 8)} peak connections ${v.maxTotal}/${poolSamples[0].app.max}, peak requests waiting for one: ${v.maxWaiting}`);
}

// 429s are a limiter doing its job (and a one-IP load generator trips them); 5xx and dead connections are failures.
const all = rows.reduce((n, r) => n + r.n, 0);
const bad = rows.reduce((n, r) => n + r.bad, 0);
const limited = rows.reduce((n, r) => n + (r.statuses[429] ?? 0), 0);
const rate = all ? bad / all : 0;
console.log(`\n${all} requests, ${bad} server errors/timeouts (${(rate * 100).toFixed(2)}%), ${limited} rate-limited (429)`);
if (limited && !SPOOF) console.log("  429s from one load-generating IP are expected; use a local API (X-Forwarded-For is then spoofed per user) or raise the limits on a staging copy.");

const failures = [];
if (rate > MAX_ERROR_RATE) failures.push(`server error rate ${(rate * 100).toFixed(2)}% > ${(MAX_ERROR_RATE * 100).toFixed(2)}%`);
if (examResult && examResult.done < examResult.total) failures.push(`${examResult.total - examResult.done} students did not finish`);
if (examResult && examResult.stored !== examResult.done) failures.push(`${examResult.done} students saw a successful submit but ${examResult.stored} attempts are stored`);
if (MAX_P95 !== null) for (const r of rows) if (r.p95 > MAX_P95) failures.push(`${r.key} p95 ${r.p95.toFixed(0)}ms > ${MAX_P95}ms`);

const jsonPath = flag("json", false);
if (jsonPath && jsonPath !== true) {
  writeFileSync(jsonPath, JSON.stringify({ startedAt, api: API, args: { SIGNUPS, CLASSES, STUDENTS, RAMP_S, THINK_MS, QUESTIONS }, rows, exam: examResult, poolSamples, failures }, null, 2));
  console.log(`results written to ${jsonPath}`);
}

// An open pg client keeps the process alive, so close it and exit explicitly.
await db.end();
if (failures.length) {
  console.log(`\nFAIL\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("\nPASS");
process.exit(0);
