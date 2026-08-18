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
import { existsSync } from "node:fs";
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

  it("guards roster, evaluation and attempt routes", async () => {
    for (const route of ["/students", "/classes", "/evaluations", "/attempts"]) {
      const res = await fetch(`${base}${route}`);
      assert.equal(res.status, 401, `${route} must require a token`);
    }
  });

  it("guards the Unsplash lookup route", async () => {
    // Shares one server-side access key across every teacher — an
    // unauthenticated caller could otherwise exhaust the app's whole rate limit.
    const res = await fetch(`${base}/media/unsplash-photo?query=math`);
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
