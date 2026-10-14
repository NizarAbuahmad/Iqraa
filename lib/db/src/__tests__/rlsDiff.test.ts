import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

/**
 * The audit, as a test. Boots the built API twice against one seeded database —
 * RLS_ENFORCE off, then on — and drives the same requests as every kind of user.
 * Turning enforcement on must change nothing anyone can see or cause. A status, a
 * body, a push notification or a row left behind that differs is a query that reads
 * another user's rows (or a policy that is too tight): it shows up here, not in
 * production. Run it after every route change that touches a protected table.
 *
 * Needs `pnpm --filter @workspace/api-server build` first, and a migrated database.
 */
const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../artifacts/api-server/dist/index.mjs");
const skip = !TEST_URL ? "RLS_TEST_DATABASE_URL not set" : !existsSync(entry) ? "build the api-server first" : false;
const SECRET = "rls-diff-secret-padded-to-clear-the-32-char-boot-check";
const SITE_KEY = "rls-diff-site-key";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // what the API accepts in share and login codes

function accessToken(sub: string, role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, email: `${sub}@rls.test`, role, type: "access", iat: now, exp: now + 600 });
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}

const randomCode = (length: number) => Array.from(randomBytes(length), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

interface Server { base: string; child: ChildProcess; logs: string[]; pushLog: string }

// Preloaded into each server: records every Expo push instead of sending it, so a
// notification that silently stops being sent shows up in the comparison, and so does a
// wrong app-icon badge (the recipient's whole-inbox unread count). A token
// containing "dead" is answered the way Expo answers an uninstalled app.
const PUSH_STUB = `
import { appendFileSync } from "node:fs";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("exp.host")) {
    const messages = JSON.parse(init.body);
    for (const m of messages) appendFileSync(process.env.RLS_PUSH_LOG, JSON.stringify({ to: m.to, title: m.title, body: m.body, badge: m.badge }) + "\\n");
    const data = messages.map(m => String(m.to).includes("dead")
      ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
      : { status: "ok" });
    return new Response(JSON.stringify({ data }), { status: 200 });
  }
  return realFetch(url, init);
};
`;

async function boot(enforce: "on" | "off"): Promise<Server> {
  const dir = mkdtempSync(path.join(tmpdir(), "rls-diff-"));
  const stub = path.join(dir, "push-stub.mjs");
  const pushLog = path.join(dir, "pushes.jsonl");
  writeFileSync(stub, PUSH_STUB);
  writeFileSync(pushLog, "");
  const port = 8500 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: TEST_URL!,
      SESSION_SECRET: SECRET,
      OPENAI_API_KEY: "sk-test-placeholder",
      SITE_INGEST_KEY: SITE_KEY,
      RLS_ENFORCE: enforce,
      STUDENT_ACCOUNTS: "true", // parent and student routes answer 403 without it
      MASTERY_GATE: "true", // the student retake route answers 403 without it
      NODE_OPTIONS: `--import ${stub}`,
      RLS_PUSH_LOG: pushLog,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", (chunk: Buffer) => logs.push(...chunk.toString().split("\n").filter(Boolean)));
  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { base, child, logs, pushLog }; } catch { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error(`server (${enforce}) did not start`);
    await new Promise(r => setTimeout(r, 150));
  }
}

/** `updatedAt` moves whenever an endpoint syncs something as a side effect, so two concurrent reads differ by milliseconds. */
function withoutVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutVolatile);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "updatedAt").map(([k, v]) => [k, withoutVolatile(v)]));
  }
  return value;
}

/** The first place two JSON values disagree, with a little context — whole bodies are too long to read. */
function firstDifference(a: unknown, b: unknown, at = "$"): { off: string; on: string } {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) return { off: "(same)", on: "(same)" };
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
      const x = (a as Record<string, unknown>)[k];
      const y = (b as Record<string, unknown>)[k];
      if (JSON.stringify(x) !== JSON.stringify(y)) return firstDifference(x, y, `${at}.${k}`);
    }
  }
  return { off: `${at} = ${sa?.slice(0, 120)}`, on: `${at} = ${sb?.slice(0, 120)}` };
}

interface Reply { status: number; label: string; json: Record<string, unknown> }

async function request(server: Server, method: string, url: string, opts: { bearer?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> {
  const res = await fetch(`${server.base}${url}`, {
    method,
    headers: { "content-type": "application/json", ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}), ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const code = typeof json["code"] === "string" ? ` ${json["code"]}` : "";
  return { status: res.status, label: `${res.status}${code}`, json: withoutVolatile(json) as Record<string, unknown> };
}

describe("turning row-level security on changes nothing a user can see or cause", { skip }, () => {
  let owner: pg.Pool;
  let fx: Fixture;
  let off: Server;
  let on: Server;

  before(async () => {
    owner = new pg.Pool({ connectionString: TEST_URL, max: 3 });
    fx = await seed(owner);
    [off, on] = await Promise.all([boot("off"), boot("on")]);
  });
  after(async () => {
    off?.child.kill();
    on?.child.kill();
    await fx?.cleanup();
    await owner?.end();
  });

  test("control: the enforcing server really runs queries as iqraa_app", async () => {
    // schedule_periods is unprotected and untouched by the other suites, so revoking it
    // here breaks nothing else. Off: the owner still reads it. On: the role switch makes
    // the same request fail. If both answered 200 this suite would be comparing two
    // servers that behave identically for the wrong reason.
    const token = accessToken(fx.ids.teacherA!, "teacher");
    await owner.query("REVOKE SELECT ON schedule_periods FROM iqraa_app");
    try {
      const [a, b] = await Promise.all([request(off, "GET", "/schedule", { bearer: token }), request(on, "GET", "/schedule", { bearer: token })]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 500);
    } finally {
      await owner.query("GRANT SELECT ON schedule_periods TO iqraa_app");
    }
  });

  // ── Reads ─────────────────────────────────────────────────────────────────
  const READS = (i: Fixture["ids"]): Record<string, [string, string[]]> => ({
    teacherA: ["teacher", [
      "/auth/me", "/classes", `/classes/${i.classA}`, `/classes/${i.classA}/mastery`, `/classes/${i.classA}/support-groups`,
      `/classes/${i.classA}/resources`, `/classes/${i.classA}/parent-contacts`, "/students",
      `/students/${i.studentA}/parent-contacts`, `/students/${i.studentA}/claim-code`,
      `/classes/${i.classA}/students/${i.studentA}/record`, "/evaluations", `/evaluations/${i.evalA}`,
      `/evaluations/${i.evalA}/attempts`, `/evaluations/${i.evalA}/coverage`, `/evaluations/${i.evalA}/insights`,
      `/attempts/${i.attemptA}`, "/messaging/contacts", "/messaging/threads", `/messaging/threads/${i.threadDirect}`,
      `/messaging/threads/${i.threadDirect}/messages`, `/messaging/threads/class/${i.classA}`,
      "/exam-calendar?from=2026-01-01&to=2026-12-31", "/schedule", "/teaching-plans", "/workspace/items",
    ]],
    teacherB: ["teacher", ["/students", "/evaluations", `/evaluations/${i.evalA}`, `/attempts/${i.attemptA}`, `/classes/${i.classA}`, `/messaging/threads/${i.threadDirect}`, "/messaging/threads"]],
    parentA: ["parent", [
      "/auth/me", "/parent/exams", "/student/exams", "/student/grades", "/student/progress", "/messaging/contacts",
      "/messaging/threads", `/messaging/threads/${i.threadDirect}`, `/messaging/threads/${i.threadDirect}/messages`,
    ]],
    parentB: ["parent", ["/parent/exams", "/messaging/contacts", "/messaging/threads", `/messaging/threads/${i.threadDirect}`]],
    studentUser: ["student", ["/auth/me", "/student/exams", "/student/grades", "/student/progress", "/messaging/contacts", "/messaging/threads"]],
    admin: ["system_admin", ["/moderation/reports", "/admin/users", "/admin/usage-summary", "/admin/metrics"]],
  });

  test("every read answers the same with enforcement on and off", async () => {
    const differences: string[] = [];
    let compared = 0;
    for (const [who, [role, urls]] of Object.entries(READS(fx.ids))) {
      const token = accessToken(fx.ids[who]!, role);
      for (const url of urls) {
        const [a, b] = await Promise.all([request(off, "GET", url, { bearer: token }), request(on, "GET", url, { bearer: token })]);
        compared++;
        if (process.env.RLS_DIFF_VERBOSE) console.log(`READ ${who.padEnd(11)} ${a.status}/${b.status} ${url}`);
        if (a.status !== b.status || JSON.stringify(a.json) !== JSON.stringify(b.json)) {
          const d = firstDifference(a.json, b.json);
          differences.push(`${who} GET ${url}\n   off ${a.status} ${d.off}\n   on  ${b.status} ${d.on}`);
        }
      }
    }
    assert.ok(compared > 50, `only compared ${compared} requests`);
    assert.deepEqual(differences, [], `\n${differences.join("\n")}\n`);
  });

  // ── Writes and side effects ───────────────────────────────────────────────
  // Each server gets its own fixture, so one mode's mutations cannot change the other's
  // answers. Statuses (and error codes) are compared, not ids, which differ.

  /** How many rows each table holds for one fixture's people — effects a status cannot show. */
  async function fingerprint(i: Fixture["ids"]): Promise<Record<string, number>> {
    const people = [i.teacherA, i.teacherB, i.parentA, i.parentB, i.studentUser, i.studentUser2, i.admin];
    const threads = `SELECT id FROM chat_threads WHERE created_by = ANY($1::uuid[]) OR class_group_id IN (SELECT id FROM class_groups WHERE teacher_id = ANY($1::uuid[]))`;
    const messages = `SELECT id FROM chat_messages WHERE thread_id IN (${threads})`;
    const attempts = `SELECT id FROM attempts WHERE evaluation_id = '${i.evalA}'`;
    const count = async (sql: string) => Number((await owner.query(sql, sql.includes("$1") ? [people] : [])).rows[0].n);
    return {
      participants: await count(`SELECT count(*) n FROM chat_participants WHERE thread_id IN (${threads})`),
      messages: await count(`SELECT count(*) n FROM (${messages}) m`),
      reads: await count(`SELECT count(*) n FROM chat_message_reads WHERE message_id IN (${messages})`),
      reactions: await count(`SELECT count(*) n FROM chat_message_reactions WHERE message_id IN (${messages})`),
      reports: await count(`SELECT count(*) n FROM chat_reports WHERE reporter_user_id = ANY($1::uuid[])`),
      threads: await count(`SELECT count(*) n FROM (${threads}) t`),
      classes: await count(`SELECT count(*) n FROM class_groups WHERE teacher_id = ANY($1::uuid[])`),
      students: await count(`SELECT count(*) n FROM students WHERE teacher_id = ANY($1::uuid[])`),
      memberships: await count(`SELECT count(*) n FROM class_memberships WHERE class_group_id IN (SELECT id FROM class_groups WHERE teacher_id = ANY($1::uuid[]))`),
      links: await count(`SELECT count(*) n FROM roster_links WHERE student_id IN (SELECT id FROM students WHERE teacher_id = ANY($1::uuid[]))`),
      contacts: await count(`SELECT count(*) n FROM parent_contacts WHERE teacher_id = ANY($1::uuid[])`),
      pushTokens: await count(`SELECT count(*) n FROM device_push_tokens WHERE user_id = ANY($1::uuid[])`),
      refreshTokens: await count(`SELECT count(*) n FROM refresh_tokens WHERE user_id = ANY($1::uuid[])`),
      attempts: await count(`SELECT count(*) n FROM (${attempts}) a`),
      grades: await count(`SELECT count(*) n FROM attempt_question_grades WHERE attempt_id IN (${attempts})`),
      results: await count(`SELECT count(*) n FROM attempt_results WHERE attempt_id IN (${attempts})`),
      signups: await count(`SELECT count(*) n FROM site_signups WHERE email = 'rls-${i.teacherA}@rls.test'`),
      retakeSittings: await count(`SELECT count(*) n FROM attempts WHERE evaluation_id IN (SELECT id FROM evaluations WHERE teacher_id = ANY($1::uuid[]) AND id <> '${i.evalA}')`),
      retakes: await count(`SELECT count(*) n FROM attempt_retakes WHERE student_id IN (SELECT id FROM students WHERE teacher_id = ANY($1::uuid[]))`),
    };
  }

  interface WriteRun { steps: string[]; cleanup: () => Promise<void>; teacherPrefix: string; state: Record<string, number> }

  async function runWrites(server: Server, mode: "on" | "off"): Promise<WriteRun> {
    const f = await seed(owner);
    const i = f.ids;
    const prefix = i.teacherA!.slice(0, 8);
    const bearer: Record<string, string> = {
      teacher: accessToken(i.teacherA!, "teacher"),
      parent: accessToken(i.parentA!, "parent"),
      otherParent: accessToken(i.parentB!, "parent"),
      student: accessToken(i.studentUser!, "student"),
      student2: accessToken(i.studentUser2!, "student"),
      admin: accessToken(i.admin!, "system_admin"),
    };
    const q = (sql: string, v: unknown[] = []) => owner.query(sql, v);
    const steps: string[] = [];
    const step = async (name: string, who: keyof typeof bearer, method: string, url: string, body?: unknown) => {
      const reply = await request(server, method, url, { bearer: bearer[who], body });
      steps.push(`${name}: ${reply.label}`);
      return reply;
    };
    const publicStep = async (name: string, method: string, url: string, opts: { bearer?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
      const reply = await request(server, method, url, opts);
      steps.push(`${name}: ${reply.label}`);
      return reply;
    };

    // ── Fixture the seed does not cover ──
    const loginCode = randomCode(12);
    await q("DELETE FROM chat_blocks WHERE blocker_user_id = $1", [i.parentA]);
    await q("UPDATE users SET roster_consent_at = now(), roster_consent_version = '2026-09-05.v1' WHERE id = $1", [i.teacherA]);
    await q("UPDATE users SET login_code_hash = $2 WHERE id = $1", [i.parentA, createHash("sha256").update(loginCode).digest("hex")]);
    await q("UPDATE attempts SET question_snapshot = $2::jsonb, submitted_at = now(), status = 'submitted' WHERE id = $1", [i.attemptA, JSON.stringify([{ id: i.questionA, evaluationId: i.evalA, type: "mcq", marks: 1 }])]);
    await q("UPDATE evaluations SET status = 'published' WHERE id = $1", [i.evalA]);
    for (const [who, label] of [[i.teacherA, "teacher"], [i.parentA, "parent"], [i.studentUser, "student"], [i.admin, "admin"], [i.teacherA, "dead"]] as const) {
      await q("INSERT INTO device_push_tokens (user_id, expo_push_token, platform) VALUES ($1, $2, 'android')", [who, `ExponentPushToken[${label}-${mode}-${prefix}]`]);
    }

    // A failed, released, single-lesson quiz the student sat through their own link: the retake route
    // deletes the attempt and records the discarded mark, as the student (the policy that allows it).
    const evalR = randomUUID();
    await q("INSERT INTO evaluations (id, teacher_id, grade_id, subject_id, book_id, status, share_code, release_results_to_student, objective_ids) VALUES ($1,$2,'g10','chemistry','b1','published',$3,true,$4::jsonb)", [evalR, i.teacherA, randomCode(8), JSON.stringify(["o-nccd-chem-s1-u1_l1-0"])]);
    const { rows: [sitting] } = await q("INSERT INTO attempts (evaluation_id, student_id, source, status, submitted_at) VALUES ($1,$2,'student_link','submitted',now()) RETURNING id", [evalR, i.studentA]);
    await q("INSERT INTO attempt_results (attempt_id, percent, total_marks, earned_marks, is_provisional) VALUES ($1, 40, 10, 4, false)", [sitting?.id]);

    // ── Direct messages: open from both sides (the second is the ON CONFLICT path), post, react, read ──
    await step("teacher opens DM", "teacher", "POST", "/messaging/threads", { counterpartUserId: i.parentA });
    await step("parent re-opens DM", "parent", "POST", "/messaging/threads", { counterpartUserId: i.teacherA });
    // The teacher's post pushes parentA with a badge counting their WHOLE inbox. Put an unread
    // message in a thread the teacher is not in, so the badge only comes out right if it is
    // counted outside the sender's identity.
    await q("INSERT INTO chat_participants (thread_id, user_id) VALUES ($1, $2)", [i.threadOther, i.parentA]);
    await q("INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'unread elsewhere')", [i.threadOther, i.teacherB]);
    await step("teacher posts", "teacher", "POST", `/messaging/threads/${i.threadDirect}/messages`, { body: "hello" });
    // The inbox sorts by the thread's updatedAt, and the parent did not create this thread: a bump
    // that matches no row under enforcement raises no error and leaves the thread where it was.
    await q("UPDATE chat_threads SET updated_at = '2000-01-01' WHERE id = $1", [i.threadDirect]);
    await step("parent posts", "parent", "POST", `/messaging/threads/${i.threadDirect}/messages`, { body: "reply" });
    const { rows: [bumped] } = await q("SELECT updated_at > '2001-01-01' AS moved FROM chat_threads WHERE id = $1", [i.threadDirect]);
    steps.push(`thread moved up after the parent's post: ${bumped?.moved}`);
    await step("parent reacts", "parent", "PUT", `/messaging/threads/${i.threadDirect}/messages/${i.msgDirect}/reaction`, { emoji: "👍" });
    await step("parent unreacts", "parent", "DELETE", `/messaging/threads/${i.threadDirect}/messages/${i.msgDirect}/reaction`);
    await step("teacher marks read", "teacher", "POST", `/messaging/threads/${i.threadDirect}/read`);
    await step("parent marks all read", "parent", "POST", "/messaging/threads/read-all");

    // ── Groups, blocks, and who gets a push ──
    await step("teacher creates group", "teacher", "POST", "/messaging/threads/custom", { title: "Group", participantUserIds: [i.parentA] });
    const { rows: [custom] } = await q("SELECT id FROM chat_threads WHERE type = 'custom_group' AND created_by = $1", [i.teacherA]);
    await q("UPDATE chat_threads SET student_posting_enabled = true WHERE id = $1", [custom?.id]);
    await q("INSERT INTO chat_participants (thread_id, user_id) VALUES ($1, $2)", [custom?.id, i.parentB]);
    await step("teacher posts in group", "teacher", "POST", `/messaging/threads/${custom?.id}/messages`, { body: "announce" });
    await step("parent blocks another parent", "parent", "POST", "/messaging/blocks", { blockedUserId: i.parentB });
    // parentB's post must reach the teacher (whose dead token is pruned) but not parentA, who blocked them.
    await step("blocked parent posts in group", "otherParent", "POST", `/messaging/threads/${custom?.id}/messages`, { body: "from the blocked one" });
    await step("parent unblocks them", "parent", "DELETE", `/messaging/blocks/${i.parentB}`);
    await step("parent hides group", "parent", "POST", `/messaging/threads/${custom?.id}/hide`);
    await step("teacher broadcasts", "teacher", "POST", "/messaging/threads/broadcast", { participantUserIds: [i.parentA], body: "all" });
    await step("parent reports", "parent", "POST", "/messaging/reports", { threadId: i.threadDirect, reportedUserId: i.teacherA, reason: "x" });
    const phone = `ExponentPushToken[phone-${mode}-${prefix}]`;
    await step("teacher registers device", "teacher", "POST", "/messaging/device-tokens", { expoPushToken: phone, platform: "android" });
    await step("parent registers the same device", "parent", "POST", "/messaging/device-tokens", { expoPushToken: phone, platform: "android" });
    await step("teacher blocks a parent", "teacher", "POST", "/messaging/blocks", { blockedUserId: i.parentA });
    await step("blocked parent opens DM", "parent", "POST", "/messaging/threads", { counterpartUserId: i.teacherA });
    await step("teacher unblocks the parent", "teacher", "DELETE", `/messaging/blocks/${i.parentA}`);

    // ── Signing in with a login code, refreshing, and a public signup that pushes the admins ──
    const signedIn = await publicStep("code login", "POST", "/auth/code-login", { body: { loginCode } });
    await publicStep("refresh", "POST", "/auth/refresh", { body: { refreshToken: signedIn.json["refreshToken"] } });
    await publicStep("public waitlist signup", "POST", "/site/signups", { body: { kind: "waitlist", email: `rls-${i.teacherA}@rls.test`, name: "n" }, headers: { "x-site-key": SITE_KEY } });

    // ── Roster ──
    await step("teacher creates class", "teacher", "POST", "/classes", { name: "Second" });
    const { rows: [c2] } = await q("SELECT id FROM class_groups WHERE teacher_id = $1 AND name = 'Second'", [i.teacherA]);
    await step("teacher adds a student to it", "teacher", "POST", `/classes/${c2?.id}/students`, { displayName: "New Kid" });
    await step("teacher edits a student", "teacher", "PATCH", `/students/${i.studentA}`, { teacherNote: "note" });
    await step("teacher logs a parent contact", "teacher", "POST", `/students/${i.studentA}/parent-contacts`, { kind: "missing-homework", channel: "copy" });
    await step("teacher issues a join code", "teacher", "POST", `/classes/${i.classA}/join-code`);
    // A parent claims a student with the teacher's code: the lookup runs before any link
    // exists, and the claim adds them to the class thread.
    const studentD = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Claim Kid')", [studentD, i.teacherA]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentD]);
    const issued = await step("teacher issues a claim code", "teacher", "POST", `/students/${studentD}/claim-code`);
    await step("parent claims a student", "otherParent", "POST", "/auth/claim", { claimCode: issued.json["claimCode"] });
    // A student claims their own record: the claim syncs them into the class thread, a write
    // to a thread they do not own and cannot see until it lands.
    const studentE = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Own Record')", [studentE, i.teacherA]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentE]);
    const issuedForStudent = await step("teacher issues a claim code for a student account", "teacher", "POST", `/students/${studentE}/claim-code`);
    await step("student claims their own record", "student2", "POST", "/auth/claim", { claimCode: issuedForStudent.json["claimCode"] });
    // Checked now, not in the final fingerprint: the next teacher action reconciles the thread
    // again and would hide a claim that silently failed to add the student.
    const { rows: [members] } = await q("SELECT count(*)::int AS n FROM chat_participants WHERE thread_id = $1", [i.threadClass]);
    steps.push(`class thread members right after the claim: ${members?.n}`);
    await step("teacher reissues a parent's login code", "teacher", "POST", `/students/${i.studentA}/links/${i.parentA}/login-code`);
    await step("teacher removes a student from the class", "teacher", "DELETE", `/classes/${i.classA}/students/${i.studentA}`);
    await step("teacher unlinks a parent", "teacher", "DELETE", `/students/${i.studentA}/links/${i.parentA}`);
    await step("admin sets a password", "admin", "POST", `/admin/users/${i.parentA}/password`, { password: "RlsDiff-Passw0rd-2026!" });

    // ── Exams: grade, comment, release (which fans out notifications) ──
    await step("teacher grades a question", "teacher", "PUT", `/attempts/${i.attemptA}/grades/${i.questionA}`, { awardedMarks: 1, verdict: "correct" });
    await step("teacher comments", "teacher", "PATCH", `/attempts/${i.attemptA}`, { teacherComment: "well done" });
    await step("teacher releases results", "teacher", "POST", `/evaluations/${i.evalA}/results-release`, { released: true });
    await step("student reads exams", "student", "GET", "/student/exams");
    await step("student reads progress", "student", "GET", "/student/progress");
    await step("student retakes the failed quiz", "student", "POST", `/student/exams/${evalR}/retake`);
    await step("student retakes it again", "student", "POST", `/student/exams/${evalR}/retake`);

    // ── A student taking the exam from a shared link: no login, so no identity at all ──
    const scale = randomUUID();
    await q("INSERT INTO level_scales (id, name) VALUES ($1, $2)", [scale, `rls-${scale}`]);
    await q("INSERT INTO level_bands (scale_id, key, label_ar, label_en, min_percent, max_percent) VALUES ($1,'low','ضعيف','Low',0,49), ($1,'high','متقدم','High',50,100)", [scale]);
    const shareCode = randomCode(8);
    await q("UPDATE evaluations SET level_scale_id = $2, share_code = $3, share_code_expires_at = NULL, class_group_id = $4 WHERE id = $1", [i.evalA, scale, shareCode, i.classA]);
    await q("UPDATE evaluation_questions SET type = 'true_false' WHERE id = $1", [i.questionA]);
    const studentC = randomUUID();
    await q("INSERT INTO students (id, teacher_id, display_name) VALUES ($1, $2, 'Link Kid'), ($3, $2, 'Assigned Kid')", [studentC, i.teacherA, randomUUID()]);
    await q("INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)", [i.classA, studentC]);
    // The exam is assigned to one student only, so the link must refuse everyone else.
    await q("INSERT INTO evaluation_assignments (evaluation_id, student_id, assigned_by) VALUES ($1, $2, $3)", [i.evalA, i.studentA, i.teacherA]);
    await publicStep("link - open the exam", "GET", `/take/${shareCode}`);
    const refused = await publicStep("link - pick a name outside the group", "POST", `/take/${shareCode}/claim`, { body: { studentId: studentC } });
    await publicStep("link - answer with the refused token", "PUT", `/take/attempt/answers/${i.questionA}`, { bearer: refused.json["token"] as string | undefined, body: { response: { value: true } } });
    // Lift the restriction so the same student can sit it, and walk the whole attempt.
    await q("DELETE FROM evaluation_assignments WHERE evaluation_id = $1", [i.evalA]);
    const claimed = await publicStep("link - pick a name", "POST", `/take/${shareCode}/claim`, { body: { studentId: studentC } });
    const token = claimed.json["token"] as string | undefined;
    await publicStep("link - read state", "GET", "/take/attempt/state", { bearer: token });
    await publicStep("link - answer", "PUT", `/take/attempt/answers/${i.questionA}`, { bearer: token, body: { response: { value: true } } });
    await publicStep("link - hand in", "POST", "/take/attempt/submit", { bearer: token, body: {} });
    await publicStep("link - result", "GET", "/take/attempt/result", { bearer: token });

    await new Promise(r => setTimeout(r, 800)); // fire-and-forget work (push, group line) finishes after the response
    return { steps, cleanup: f.cleanup, teacherPrefix: prefix, state: await fingerprint(i) };
  }

  test("every write answers the same with enforcement on and off — and leaves the same behind", async () => {
    const [a, b] = await Promise.all([runWrites(off, "off"), runWrites(on, "on")]);
    try {
      if (process.env.RLS_DIFF_VERBOSE) for (const [n, line] of a.steps.entries()) console.log(`WRITE ${line}  | on: ${b.steps[n]?.split(": ").pop()}`);
      const statusDifferences = a.steps.flatMap((line, n) => (line === b.steps[n] ? [] : [`${line.split(": ")[0]}\n   off ${line.split(": ").pop()}\n   on  ${b.steps[n]?.split(": ").pop()}`]));

      // Strip what is specific to one fixture: the mode and id baked into each token, and the
      // signup address. (The public signup also pushes every admin in the shared database,
      // so both runs see both fixtures' admin tokens — they normalise to the same line.)
      const pushes = (server: Server) =>
        readFileSync(server.pushLog, "utf8").split("\n").filter(Boolean)
          .map(l => JSON.parse(l) as { to: string; title: string; body: string; badge?: number })
          .map(p => `${p.to} | ${p.title} | ${p.body} | badge ${p.badge}`.replace(/-(on|off)-[0-9a-f]{8}\]/g, "]").replace(/rls-[0-9a-f-]{36}@rls\.test/g, "rls-X@rls.test"))
          .sort();
      const offPushes = pushes(off);
      const onPushes = pushes(on);
      const pushDifferences = JSON.stringify(offPushes) === JSON.stringify(onPushes) ? [] : [`off sent:\n   ${offPushes.join("\n   ")}\n  on sent:\n   ${onPushes.join("\n   ")}`];

      const errors = (server: Server) => new Set(server.logs.filter(l => /"level":(50|60)|"level":"error"/.test(l)).map(l => { try { return String(JSON.parse(l).msg ?? l.slice(0, 120)); } catch { return l.slice(0, 120); } }));
      const newErrors = [...errors(on)].filter(m => !errors(off).has(m));

      assert.deepEqual(statusDifferences, [], `\nstatus differs:\n${statusDifferences.join("\n")}\n`);
      assert.deepEqual(b.state, a.state, "the rows left behind differ (expected = enforcement off, actual = on)");
      assert.deepEqual(pushDifferences, [], `\nthe pushes sent differ:\n${pushDifferences.join("")}\n`);
      assert.deepEqual(newErrors, [], `\nerrors logged only with enforcement on:\n${newErrors.join("\n")}\n`);
      assert.ok(a.steps.filter(s => /: 2\d\d/.test(s)).length >= 30, "too few steps succeeded — the scenario is not exercising the routes");
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});
