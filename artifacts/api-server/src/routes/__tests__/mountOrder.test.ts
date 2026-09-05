/**
 * What these guard: a router mounted without a path prefix must not install
 * middleware for the whole API.
 *
 * `roster.ts` and `evaluations.ts` are mounted at the root of /api. Both called
 * a bare `router.use(authMiddleware)`, which in Express matches every path — so
 * every request that reached them was answered 401 before the routers mounted
 * after them (chat, generate, verified-math) were ever consulted. Those three
 * were guarded by accident of ordering, not by intent, and reordering the
 * mounts would have silently made two OpenAI-backed routes public.
 *
 * This runs against the built bundle rather than the source: the API's import
 * graph uses extensionless specifiers that only esbuild resolves, so importing
 * app.ts directly under node --test fails. Booting dist is also what actually
 * ships, which is the thing worth asserting about.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "../../..");
const entry = path.join(serverRoot, "dist", "index.mjs");

// The bundle is a build artifact; skip rather than fail when it is absent, so a
// bare `pnpm test` on a clean checkout stays green. CI runs build before test.
const built = existsSync(entry);

describe("API mount order", { skip: built ? false : "run `pnpm build` first" }, () => {
  let child: ChildProcess;
  let base: string;

  before(async () => {
    const port = 8100 + Math.floor(Math.random() * 400);
    base = `http://127.0.0.1:${port}/api`;
    child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: String(port),
        // Never contacted: no test below reaches a route that queries them.
        DATABASE_URL: "postgres://u:p@127.0.0.1:5432/none",
        SESSION_SECRET: "test-secret",
        // chat.ts and generate.ts still construct the OpenAI client at module
        // scope, so the bundle needs a key present to boot even though nothing
        // here calls a model. Production passes a placeholder for the same
        // reason (see render.yaml).
        OPENAI_API_KEY: "sk-test-placeholder",
      },
      stdio: "ignore",
    });

    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const res = await fetch(`${base}/healthz`);
        if (res.ok) break;
      } catch {
        /* not listening yet */
      }
      if (Date.now() > deadline) throw new Error("server did not start");
      await new Promise((r) => setTimeout(r, 150));
    }
  });

  after(() => child?.kill());

  it("serves the Render health check", async () => {
    // /healthz must stay cheap and dependency-free: it is the path Render polls
    // to decide the service is alive, so the verifier probe lives separately.
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, "ok");
  });

  it("keeps published curriculum data public", async () => {
    const res = await fetch(`${base}/curriculum/grades`);
    assert.equal(res.status, 200);
  });

  it("keeps the bank catalog public, and free of what it cannot serve", async () => {
    // Same reasoning as curriculum: titles and provenance, not documents.
    const res = await fetch(`${base}/bank/items?kind=exam`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      items: Array<{ kind: string; usePolicy: string; driveId?: string; status: string }>;
      total: number;
    };
    assert.ok(body.total >= 10, `only ${body.total} exam papers`);
    for (const item of body.items) {
      assert.equal(item.kind, "exam");
      // The policy travels with the item: a caller assembling something a
      // teacher exports must not have to go and look it up.
      assert.ok(["quotable", "reference-only"].includes(item.usePolicy));
      // No handle to a file this API does not serve.
      assert.equal(item.driveId, undefined);
    }
    assert.ok(body.items.some(i => i.usePolicy === "reference-only"));
  });

  it("refuses a kind from the retired vocabulary rather than ignoring it", async () => {
    // `quiz` was the old catalog's word for both exams and question banks.
    // Answering 200 with the whole bank would look like a working query.
    const res = await fetch(`${base}/bank/items?kind=quiz`);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "unknown_kind");
  });

  it("scopes bank items to a unit, and says which tags it used", async () => {
    const res = await fetch(`${base}/bank/items?unitId=kbu-math-s1-nccd-u2`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { total: number; unitTags: string[] };
    assert.deepEqual(body.unitTags, ["s1-u2", "s1"]);
    assert.ok(body.total > 0);
  });

  it("distinguishes an unscoped unit from a unit with no material", async () => {
    // An unrecognised unit id resolves to no tags at all. Returning an empty
    // list for both cases would conflate "nothing on file" with "bad id".
    const res = await fetch(`${base}/bank/items?unitId=not-a-unit`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { total: number; unitTags: string[] };
    assert.deepEqual(body.unitTags, []);
    assert.equal(body.total, 0);
  });

  it("answers what the bank holds for a set of objectives", async () => {
    const objectives = await (await fetch(
      `${base}/curriculum/objectives?unitId=kbu-math-s1-nccd-u2`,
    )).json() as { objectives: Array<{ id: string }> };
    assert.ok(objectives.objectives.length > 0);
    const ids = objectives.objectives.slice(0, 2).map(o => o.id).join(",");

    const res = await fetch(`${base}/bank/for-objectives?objectiveIds=${encodeURIComponent(ids)},nope`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      total: number; unitIds: string[]; unknownObjectiveIds: string[];
    };
    assert.ok(body.total > 0);
    assert.deepEqual(body.unitIds, ["kbu-math-s1-nccd-u2"]);
    // An id that resolves to nothing is named, not silently dropped.
    assert.deepEqual(body.unknownObjectiveIds, ["nope"]);
  });

  it("reports how much of the bank has actually been read", async () => {
    const res = await fetch(`${base}/bank/stats`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { usable: number; ingested: number; pending: number };
    assert.equal(body.usable, body.ingested + body.pending);
    // Flipped 2026-08-26 alongside lib/curriculum's bank.test.ts: 51 documents
    // were ingested that day, taking ingested past pending for the first time.
    assert.ok(body.pending > 0, "the bank should still have unread documents to say so about");
    assert.ok(body.ingested > body.pending, "most of the bank has been read — say so");
  });

  it("keeps the verifier probe public", async () => {
    // Whether the verifier is deployed must be answerable without logging in.
    // 503 here means reachable-and-down, which is a valid answer, not a refusal.
    const res = await fetch(`${base}/healthz/verifier`);
    assert.ok(
      res.status === 200 || res.status === 503,
      `expected 200 or 503, got ${res.status}`,
    );
    const body = (await res.json()) as { verifier: string };
    assert.ok(["ok", "unreachable"].includes(body.verifier));
  });

  it("keeps the AI test-budget status public", async () => {
    const res = await fetch(`${base}/healthz/ai-budget`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { liveMode: boolean; limitUsd: number };
    assert.equal(typeof body.liveMode, "boolean");
    assert.equal(typeof body.limitUsd, "number");
  });

  it("hides the recent-errors endpoint without ADMIN_DEBUG_KEY set", async () => {
    const res = await fetch(`${base}/healthz/errors`);
    assert.equal(res.status, 404);
  });

  it("guards the OpenAI-backed routes", async () => {
    for (const route of ["/chat", "/generate/lesson-plan", "/generate/classroom-activity"]) {
      const res = await fetch(`${base}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(res.status, 401, `${route} must require a token`);
    }
  });

  it("mounts account deletion, and refuses it without a token", async () => {
    // Apple 5.1.1(v) and Play both require this route to exist, so the thing
    // worth pinning is that it is *mounted* — a 404 here is a submission
    // blocker, and would look identical to a typo in the path. 401 says the
    // route resolved and the guard ran; anything past that needs a database,
    // which this suite deliberately does not have.
    const res = await fetch(`${base}/auth/users/me`, { method: "DELETE" });
    assert.equal(res.status, 401, "account deletion must exist and require a token");
  });

  it("reports that student accounts are off, and refuses one", async () => {
    // v1 is teacher-only, and the app reads this endpoint rather than a
    // build-time copy so the two cannot disagree about which doors to show.
    const features = await fetch(`${base}/healthz/features`);
    assert.equal(features.status, 200);
    const body = (await features.json()) as { studentAccounts: boolean };
    assert.equal(body.studentAccounts, false, "the suite must run with the shipping default");

    // The refusal is the enforcement; hiding the option in the app is not.
    // 403 before any database work, which is why this passes with no DB.
    const res = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "A",
        lastName: "B",
        email: "child@example.com",
        password: "Sufficiently1Strong!",
        role: "student",
        claimCode: "ABC123",
      }),
    });
    assert.equal(res.status, 403, "a student registration must be refused");
    const refusal = (await res.json()) as { code?: string };
    assert.equal(refusal.code, "student_accounts_disabled");
  });

  it("publishes the roster consent statement without a token", async () => {
    // The app renders a translation of this; serving it keeps the wording a
    // teacher agrees to and the wording the version stamp identifies as one
    // thing rather than two.
    const res = await fetch(`${base}/auth/roster-consent`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { version: string; statement: string };
    assert.ok(body.version, "the statement must carry a version");
    assert.ok(body.statement.length > 40, "the statement must actually be the statement");
  });

  it("mounts the moderation queue, and refuses it without a token", async () => {
    // The report button has always worked; until 2026-09-05 nothing read the
    // rows. These are the routes that make a report actionable, so a 404
    // here is the same submission blocker as a missing delete route.
    const res = await fetch(`${base}/moderation/reports`);
    assert.equal(res.status, 401, "the moderation queue must exist and require a token");

    for (const route of [
      "/moderation/reports/00000000-0000-0000-0000-000000000000/resolve",
      "/moderation/users/00000000-0000-0000-0000-000000000000/unsuspend",
    ]) {
      const post = await fetch(`${base}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(post.status, 401, `${route} must require a token`);
    }
  });

  it("guards roster, evaluation, attempt and workspace routes", async () => {
    for (const route of ["/students", "/classes", "/evaluations", "/attempts", "/workspace/items"]) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 401, `${route} must require a token`);
    }
  });

  it("guards messaging routes — signed-in only, not teacher-only", async () => {
    for (const route of ["/messaging/threads", "/messaging/contacts"]) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 401, `${route} must require a token`);
    }
  });

  it("keeps the student exam link public, and only the link", async () => {
    // The one unauthenticated write surface. What is asserted is the absence of
    // a 401: that status would mean an earlier guard swallowed the request and
    // the public router never saw it, which is the failure this whole file
    // exists for.
    //
    // 500 is the *expected* answer here, not a flaw — this suite boots with a
    // deliberately unreachable DATABASE_URL, and reaching a database error is
    // itself proof the request got through to the handler. The other public
    // routes return 200 only because they never touch the database.
    const res = await fetch(`${base}/take/ZZZZZZ`);
    assert.notEqual(res.status, 401, "the student link must not require a token");
    assert.ok(
      res.status === 404 || res.status === 500,
      `expected 404 (no such code) or 500 (no database in this suite), got ${res.status}`,
    );
  });

  it("still refuses a student token where a teacher token is required", async () => {
    // A student's bearer token is scoped to one attempt. Presenting anything at
    // all to a teacher route must not be mistaken for a session.
    const res = await fetch(`${base}/evaluations`, {
      headers: { authorization: "Bearer not-a-teacher-token" },
    });
    assert.equal(res.status, 401);
  });

  it("guards the Unsplash lookup route", async () => {
    // Shares one server-side access key across every teacher — an
    // unauthenticated caller could otherwise exhaust the app's whole rate limit.
    const res = await fetch(`${base}/media/unsplash-photo?query=math`);
    assert.equal(res.status, 401);
  });

  it("guards the YouTube lookup route", async () => {
    const res = await fetch(`${base}/media/youtube-video?query=math`);
    assert.equal(res.status, 401);
  });

  it("guards feedback and admin-usage-summary routes", async () => {
    const postRes = await fetch(`${base}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(postRes.status, 401, "POST /feedback must require a token");

    for (const route of ["/feedback", "/admin/usage-summary"]) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 401, `${route} must require a token`);
    }
  });

  it("answers unknown paths with 404, not with another router's 401", async () => {
    // The tell for the original bug: a path no router owns came back 401,
    // because a root-mounted guard replied before routing finished.
    const res = await fetch(`${base}/no-such-route`);
    assert.equal(res.status, 404);
  });

  it("no longer serves classroom-activity at its old unguarded path", async () => {
    // Regression: this route was once registered without the /generate
    // prefix, so it sat outside authMiddleware's scope entirely — reachable,
    // unauthenticated, at /api/classroom-activity. It now only exists at
    // /generate/classroom-activity (covered above). 404 here, not 401 or 200,
    // confirms the stray route isn't still reachable under its old name.
    const res = await fetch(`${base}/classroom-activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 404);
  });
});

describe("the built bundle ships its data, not just its code", { skip: built ? false : "run `pnpm build` first" }, () => {
  it("puts the extracted knowledge-bank text where the bundle actually looks for it", () => {
    // `@workspace/curriculum/passages.ts` resolves `data/extracted` relative
    // to its OWN module's `import.meta.url` — correct in source and under
    // `node --test`, where that file really does sit next to a `data/`
    // sibling. Bundling collapses every module into this one dist/index.mjs,
    // so at runtime `import.meta.url` points at the bundle, not at
    // passages.ts's original location: the same expression now resolves to
    // dist/data/extracted. Nothing copied the files there, `existsSync`
    // failed, and `passagesForUnit` took the documented-honest "no text
    // extracted for this source" path — indistinguishable from a source that
    // genuinely has none. Grounding found zero passages for every production
    // request since it shipped; the UI showed a "grounded" lesson match with
    // no page citation, which is exactly what a client-side topic match with
    // an empty server-side `sources` array looks like. `build.mjs` now copies
    // the files to this exact path — assert the copy landed, not just that
    // the script contains a copy step.
    const extractedDir = path.join(path.dirname(entry), "data", "extracted");
    assert.ok(existsSync(extractedDir), "dist/data/extracted does not exist — grounding will find nothing");
    const files = readdirSync(extractedDir).filter(f => f.endsWith(".json"));
    assert.ok(files.length >= 6, `only ${files.length} extraction files shipped next to the built bundle`);
  });
});
