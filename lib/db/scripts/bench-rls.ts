// How much slower is a statement with row-level security on? (docs/rls-rollout-checklist.md, C1)
//
//   BENCH_DATABASE_URL='<pooled string of the rehearsal project>' \
//     pnpm --filter @workspace/db run bench:rls
//
// Three modes, alternating so a slow minute hits all of them:
//   off   — enforcement off, the plain pool
//   on    — enforcement on, one scoped transaction per statement (every route not on the held list)
//   held  — enforcement on, one scoped read-only connection for the whole request (a held route)
//
// Read-only: it only runs `select count(*) ... where teacher_id = <random uuid>`, so it writes nothing.
// Point it at the REHEARSAL project (migrations applied, so the iqraa_app role exists), not production.
// Run it from the API's region if you can: the extra cost is round trips, so a faraway machine
// overstates it. Use the pooled endpoint, because that is what production uses.
import { randomUUID } from "node:crypto";
import { asUser } from "../src/identity.ts";
import { runInScope } from "../src/requestScope.ts";
import { ScopedPool } from "../src/scopedPool.ts";

const url = process.env.BENCH_DATABASE_URL;
if (!url) {
  console.error("Set BENCH_DATABASE_URL to the rehearsal project's pooled connection string.");
  process.exit(1);
}
if (!/-pooler\./.test(url)) {
  console.warn("Warning: the host does not contain -pooler; production uses the pooled endpoint.\n");
}

// The teacher inbox runs 7 or 8 statements in sequence, depending on the account's data; BENCH_STATEMENTS overrides.
const STATEMENTS_PER_REQUEST = Number(process.env.BENCH_STATEMENTS ?? 8);
if (!Number.isInteger(STATEMENTS_PER_REQUEST) || STATEMENTS_PER_REQUEST <= 0) {
  console.error(`BENCH_STATEMENTS must be a positive whole number, got "${process.env.BENCH_STATEMENTS}".`);
  process.exit(1);
}
const REQUESTS = 40; // per round
const MODES = ["off", "on", "held"] as const;
type Mode = (typeof MODES)[number];
const ROUNDS = MODES.length * 2; // each mode twice
const identity = { userId: randomUUID(), role: "teacher" };

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

async function round(mode: Mode): Promise<number[]> {
  const pool = new ScopedPool({ connectionString: url, max: 4 }, mode !== "off");
  try {
    await pool.query("select 1"); // connect before the clock starts
    const perRequest: number[] = [];
    for (let r = 0; r < REQUESTS; r++) {
      const t0 = performance.now();
      const request = async () => {
        for (let n = 0; n < STATEMENTS_PER_REQUEST; n++) {
          await pool.query("select count(*) from students where teacher_id = $1", [identity.userId]);
        }
      };
      await asUser(identity, async () => {
        if (mode !== "held") return request();
        const scope = pool.openScope(identity)!;
        try {
          await runInScope(scope, request);
        } finally {
          await scope.end();
        }
      });
      perRequest.push(performance.now() - t0);
    }
    return perRequest;
  } finally {
    await pool.end();
  }
}

const times: Record<Mode, number[]> = { off: [], on: [], held: [] };
for (let i = 0; i < ROUNDS; i++) {
  const mode = MODES[i % MODES.length];
  const ms = await round(mode);
  times[mode].push(...ms);
  console.log(`round ${i + 1}: ${mode.padEnd(4)} median ${median(ms).toFixed(1)} ms per ${STATEMENTS_PER_REQUEST}-statement request`);
}

const W = 9; // one column width for the header and the rows
const f = (n: number) => n.toFixed(1).padStart(W);
const head = (s: string) => s.padStart(W);
console.log(`\n${`${STATEMENTS_PER_REQUEST} statements/request`.padEnd(26)}${["off", "on", "held", "on-off", "held-off"].map(head).join("")}`);
for (const [label, pick] of [["median ms", median], ["p95 ms", p95]] as const) {
  const [off, on, held] = MODES.map(m => pick(times[m]));
  console.log(`${label.padEnd(26)}${[off, on, held, on - off, held - off].map(f).join("")}`);
}
const heldAdded = p95(times.held) - p95(times.off);
const onAdded = p95(times.on) - p95(times.off);
console.log(`\nInbox gate (held route): added p95 per ${STATEMENTS_PER_REQUEST}-statement request <= 100 ms. This run: +${heldAdded.toFixed(1)} ms -> ${heldAdded <= 100 ? "WITHIN BUDGET" : "OVER BUDGET"}.`);
console.log(`Routes not on the held list pay the "on" column: +${onAdded.toFixed(1)} ms for ${STATEMENTS_PER_REQUEST} statements (about ${(onAdded / STATEMENTS_PER_REQUEST).toFixed(1)} ms per statement).`);
