/**
 * Three linked test accounts — a teacher, a student and a parent — so every
 * role can be tried from one device (Settings → «إضافة حساب آخر» keeps up to
 * four signed in, one tap apart).
 *
 * No single account can hold all three roles: `users.role` is one value, and
 * `POST /auth/role` refuses once a teacher has a class or a parent/student has
 * a roster link (lib/roleSwitch.ts). So this writes the world signup would
 * have built by hand, already past every first-run gate:
 *
 *   teacher  — grade-10 mathematics picked (skips /setup-subjects), owns one
 *              class with a roster of three; only the first row is linked
 *   student  — linked `self` to the first roster row, grade-10 picked
 *   parent   — linked `guardian` to the same row (skips /claim-required)
 *
 * All three sign in with email + password and are marked verified, so no code
 * is ever emailed. Terms acceptance is deliberately left unset: nobody
 * accepted them, and nothing gates on it after signup.
 *
 *   pnpm --filter @workspace/api-server run seed:test-accounts
 *   pnpm --filter @workspace/api-server run seed:test-accounts -- --email-base you@gmail.com
 *   pnpm --filter @workspace/api-server run seed:test-accounts -- --password 'Something-Long-1'
 *   pnpm --filter @workspace/api-server run seed:test-accounts -- --from-env   # use the shell's DATABASE_URL
 *
 * `--email-base you@gmail.com` makes the addresses you+teacher@gmail.com,
 * you+student@gmail.com and you+parent@gmail.com: separate accounts to the API
 * (it does not fold `+` tags), one inbox for a password reset. Without it they
 * are teacher@iqraa.test and so on, which receive nothing.
 *
 * Idempotent: re-running resets the three passwords, keeps every id, and adds
 * only what is missing. It refuses an existing account of the same email with a
 * different role rather than change it, and refuses a database that is not on
 * this machine unless `--allow-remote` is given — these are fixed, published
 * credentials, and a production database should get them only on purpose.
 *
 * Where the connection string comes from: the same rule as lib/db's scripts.
 * The repo-root `.env` wins over a shell DATABASE_URL, unless `--from-env`.
 */
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) {
    console.error(`${name} needs a value.`);
    process.exit(2);
  }
  return v;
}

const fromEnv = process.argv.includes("--from-env");
const allowRemote = process.argv.includes("--allow-remote");
const emailBase = argValue("--email-base");
const password = argValue("--password") ?? "IqrraTest-2026";

if (password.length < 8) {
  console.error("--password must be at least 8 characters.");
  process.exit(2);
}

if (!fromEnv) {
  delete process.env.DATABASE_URL;
  loadEnvFile(path.join(workspaceRoot, ".env"));
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to the repo-root .env, or pass --from-env with it in the shell.");
  process.exit(2);
}

let host;
let hostOverride = false;
try {
  const url = new URL(process.env.DATABASE_URL);
  host = url.hostname;
  // pg honours `?host=` over the hostname, so a local-looking URL can still connect elsewhere.
  hostOverride = url.searchParams.has("host");
  if (hostOverride) host = url.searchParams.get("host") ?? host;
} catch {
  console.error("DATABASE_URL is not a URL this script can read.");
  process.exit(2);
}
// `localhost` can still be a tunnel to a real server; this check cannot see that.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);
if ((!LOCAL_HOSTS.has(host) || hostOverride) && !allowRemote) {
  console.error(
    `Refusing to write test accounts to ${host}: it is not this machine.\n` +
      "The password is printed and fixed, so anyone who reads this repo could sign in.\n" +
      "Pass --allow-remote (and a --password of your own) if you mean it.",
  );
  process.exit(2);
}

/** you@gmail.com + "teacher" → you+teacher@gmail.com; none → teacher@iqraa.test. */
function emailFor(role) {
  if (!emailBase) return `${role}@iqraa.test`;
  const at = emailBase.lastIndexOf("@");
  if (at <= 0 || at === emailBase.length - 1) {
    console.error("--email-base must look like name@example.com.");
    process.exit(2);
  }
  const local = emailBase.slice(0, at).split("+")[0];
  return `${local}+${role}@${emailBase.slice(at + 1)}`.toLowerCase();
}

const GRADE = "grade-10";
const SUBJECT = "mathematics";
const CLASS_NAME = "10A Maths (test)";
const CLASS_NAME_AR = "العاشر أ — رياضيات (تجريبي)";
/** The first row is the child both the student and the parent link to. */
const ROSTER = [
  { displayName: "طالب تجريبي", gender: "male" },
  { displayName: "ليان عمر", gender: "female" },
  { displayName: "يوسف خالد", gender: "male" },
];

const ACCOUNTS = {
  teacher: { firstName: "معلّم", lastName: "تجريبي", role: "teacher", email: emailFor("teacher") },
  student: { firstName: "طالب", lastName: "تجريبي", role: "student", email: emailFor("student") },
  parent: { firstName: "وليّ أمر", lastName: "تجريبي", role: "parent", email: emailFor("parent") },
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function one(sql, params) {
  const r = await client.query(sql, params);
  return r.rows[0];
}

/** Find by email or create; always resets the password and the setup fields. */
async function upsertUser(a, passwordHash) {
  const setup =
    a.role === "teacher"
      ? { gradeIds: [GRADE], subjectIds: [SUBJECT], teaching: [{ gradeId: GRADE, subjectIds: [SUBJECT] }] }
      : { gradeIds: [GRADE], subjectIds: [], teaching: [] };

  const existing = await one(`SELECT id, role FROM users WHERE email = $1`, [a.email]);
  if (existing && existing.role !== a.role) {
    throw new Error(
      `${a.email} already exists as a ${existing.role}, not a ${a.role}. ` +
        "Use another --email-base, or delete that account first.",
    );
  }
  if (existing) {
    await client.query(
      `UPDATE users SET password_hash = $2, email_verified = true, suspended_at = NULL,
         grade_ids = $3::jsonb, subject_ids = $4::jsonb, teaching_assignments = $5::jsonb
       WHERE id = $1`,
      [existing.id, passwordHash, JSON.stringify(setup.gradeIds), JSON.stringify(setup.subjectIds), JSON.stringify(setup.teaching)],
    );
    return { id: existing.id, created: false };
  }
  const row = await one(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified, preferred_language,
       grade_ids, subject_ids, teaching_assignments)
     VALUES ($1, $2, $3, $4, $5, true, 'ar', $6::jsonb, $7::jsonb, $8::jsonb) RETURNING id`,
    [
      a.firstName,
      a.lastName,
      a.email,
      passwordHash,
      a.role,
      JSON.stringify(setup.gradeIds),
      JSON.stringify(setup.subjectIds),
      JSON.stringify(setup.teaching),
    ],
  );
  return { id: row.id, created: true };
}

async function findOrInsert(selectSql, selectParams, insertSql, insertParams) {
  const found = await one(selectSql, selectParams);
  if (found) return found.id;
  return (await one(insertSql, insertParams)).id;
}

try {
  await client.connect();
  // Same cost as lib/passwordHash.ts, so sign-in behaves exactly as for a real account.
  const passwordHash = await bcrypt.hash(password, 12);

  await client.query("BEGIN");

  const teacher = await upsertUser(ACCOUNTS.teacher, passwordHash);
  const student = await upsertUser(ACCOUNTS.student, passwordHash);
  const parent = await upsertUser(ACCOUNTS.parent, passwordHash);

  const classId = await findOrInsert(
    `SELECT id FROM class_groups WHERE teacher_id = $1 AND name = $2 AND archived_at IS NULL`,
    [teacher.id, CLASS_NAME],
    `INSERT INTO class_groups (teacher_id, name, name_ar, grade_id, subject_id, subject_ids)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
    [teacher.id, CLASS_NAME, CLASS_NAME_AR, GRADE, SUBJECT, JSON.stringify([SUBJECT])],
  );

  const rosterIds = [];
  for (const r of ROSTER) {
    const sid = await findOrInsert(
      `SELECT id FROM students WHERE teacher_id = $1 AND display_name = $2 AND archived_at IS NULL`,
      [teacher.id, r.displayName],
      `INSERT INTO students (teacher_id, display_name, display_name_ar, grade_id, gender)
       VALUES ($1, $2, $2, $3, $4) RETURNING id`,
      [teacher.id, r.displayName, GRADE, r.gender],
    );
    await client.query(
      `INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)
       ON CONFLICT (class_group_id, student_id) DO NOTHING`,
      [classId, sid],
    );
    rosterIds.push(sid);
  }

  const child = rosterIds[0];
  // A roster row has at most one `self` link (roster_links_one_self_idx). If another
  // account already claimed this one, say so rather than steal it.
  const selfHolder = await one(`SELECT user_id FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [child]);
  if (selfHolder && selfHolder.user_id !== student.id) {
    throw new Error(`The roster row «${ROSTER[0].displayName}» is already claimed by another student account.`);
  }
  await client.query(
    `INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')
     ON CONFLICT (student_id, user_id) DO NOTHING`,
    [child, student.id],
  );
  await client.query(
    `INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')
     ON CONFLICT (student_id, user_id) DO NOTHING`,
    [child, parent.id],
  );

  await client.query("COMMIT");

  const state = (u) => (u.created ? "created" : "updated");
  console.log(`Seeded test accounts on ${host || "local socket"}:\n`);
  console.log(`  teacher  ${ACCOUNTS.teacher.email}  (${state(teacher)})`);
  console.log(`  student  ${ACCOUNTS.student.email}  (${state(student)})`);
  console.log(`  parent   ${ACCOUNTS.parent.email}  (${state(parent)})`);
  console.log(`\n  password for all three: ${password}`);
  console.log(`\n  class «${CLASS_NAME_AR}»: ${ROSTER.length} students; «${ROSTER[0].displayName}» is the student account and the parent's child.`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Seeding failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
