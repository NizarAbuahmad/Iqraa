import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { TEST_URL } from "../testing/rlsHarness.ts";

/**
 * Every table is either protected by row-level security or on a written list of tables
 * not protected *yet*. A new table fails this until someone classifies it — the point is
 * that "forgot to think about RLS" cannot pass CI.
 *
 * Moving a table between the lists is the whole job of a follow-up RLS PR: add its
 * policies in a migration, then move its name from DEFERRED to PROTECTED here.
 */
const PROTECTED = [
  "attempt_answers", "attempt_question_grades", "attempt_results", "attempt_retakes", "attempts",
  "chat_blocks", "chat_message_reactions", "chat_message_reads", "chat_messages", "chat_participants",
  "chat_reports", "chat_threads", "class_groups", "class_memberships", "device_push_tokens",
  "evaluation_assignments", "evaluation_questions", "evaluations", "grade_overrides", "grading_jobs",
  "mastery_overrides", "parent_contacts", "recommendations", "roster_links", "roster_link_requests", "students",
] as const;

/** RLS on, no policy, and no grant: only the owner connection (systemDb) can read them. */
const LOCKED = ["email_verification_tokens", "guardian_consents", "password_reset_tokens", "refresh_tokens"] as const;

const DEFERRED = [
  "ai_artifact_reports", "ai_artifacts", "ai_generations", "class_resources", "competency_definitions",
  "conversations", "feedback", "game_results", "homework", "homework_completions", "homework_reminders", "lesson_media", "level_bands", "level_scales", "library_resources",
  "live_answers", "live_games", "live_players", "manual_metrics", "math_practice_results", "messages", "rate_limit_buckets", "rubric_templates", "saved_materials",
  "schedule_periods", "schedule_slots", "schools", "site_signups", "teaching_plans", "users",
] as const;

describe("row-level security covers every table", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  let owner: pg.Pool;
  before(() => { owner = new pg.Pool({ connectionString: TEST_URL, max: 1 }); });
  after(() => owner.end());

  const rows = async (sql: string) => (await owner.query(sql)).rows as Record<string, unknown>[];
  const names = async (sql: string) => (await rows(sql)).map(r => String(Object.values(r)[0])).sort();

  test("each table is protected, locked, or explicitly deferred — and nothing is in two lists", async () => {
    const all = await names(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const listed = [...PROTECTED, ...LOCKED, ...DEFERRED];
    assert.equal(new Set(listed).size, listed.length, "a table is on two lists");
    assert.deepEqual(all, [...listed].sort(), "a table exists that is on no list (or a listed table is gone)");
  });

  test("RLS is on exactly for the protected and locked tables", async () => {
    const on = await names(`SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity`);
    assert.deepEqual(on, [...PROTECTED, ...LOCKED].sort());
  });

  test("every protected table has a policy; a locked table has none", async () => {
    const withPolicy = await names(`SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'`);
    assert.deepEqual(withPolicy, [...PROTECTED].sort());
  });

  test("the app role reaches protected and deferred tables, and never the locked ones", async () => {
    for (const table of [...PROTECTED, ...DEFERRED]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const [{ ok }] = (await owner.query(`SELECT has_table_privilege('iqraa_app', $1, $2) AS ok`, [`public.${table}`, privilege])).rows;
        assert.equal(ok, true, `iqraa_app lacks ${privilege} on ${table}`);
      }
    }
    for (const table of LOCKED) {
      const [{ ok }] = (await owner.query(`SELECT has_table_privilege('iqraa_app', $1, 'SELECT') AS ok`, [`public.${table}`])).rows;
      assert.equal(ok, false, `iqraa_app must not read ${table}`);
    }
  });

  test("the app role cannot bypass policies, log in, or own anything", async () => {
    const [role] = await rows(`SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreaterole FROM pg_roles WHERE rolname = 'iqraa_app'`);
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, rolcanlogin: false, rolcreaterole: false });
    const owned = await names(`SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'iqraa_app'`);
    assert.deepEqual(owned, []);
  });

  // A SECURITY DEFINER function runs with its owner's rights; without a pinned search_path a
  // schema the caller controls could shadow a table or function it names.
  test("every SECURITY DEFINER helper pins its search_path", async () => {
    const helpers = await rows(`SELECT proname, prosecdef, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'app\\_%'`);
    assert.ok(helpers.length >= 15, `only found ${helpers.length} helpers`);
    for (const h of helpers) {
      if (!h["prosecdef"]) continue;
      assert.ok(((h["proconfig"] as string[] | null) ?? []).some(c => c.startsWith("search_path=")), `${h["proname"]} does not pin search_path`);
    }
  });
});
