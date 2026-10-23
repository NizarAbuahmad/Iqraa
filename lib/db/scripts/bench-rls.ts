// How much slower is a statement with row-level security on? (docs/rls-rollout-checklist.md, C1)
//
//   BENCH_DATABASE_URL='<pooled string of the rehearsal project>' \
//     pnpm --filter @workspace/db run bench:rls
//
// Read-only: it only runs `select count(*) ... where teacher_id = <random uuid>`, so it writes nothing.
// Point it at the REHEARSAL project (migrations applied, so the iqraa_app role exists), not production.
// Run it from the API's region if you can (a Cloud Run job or a VM there): the extra cost is round
// trips, so a faraway machine overstates it. Needs a connection string from Neon's pooled endpoint,
// because that is what production uses.
import { randomUUID } from "node:crypto";
import { asUser } from "../src/identity.ts";
import { ScopedPool } from "../src/scopedPool.ts";

const url = process.env.BENCH_DATABASE_URL;
if (!url) {
  console.error("Set BENCH_DATABASE_URL to the rehearsal project's pooled connection string.");
  process.exit(1);
}
if (!/-pooler\./.test(url)) {
  console.warn("Warning: the host does not contain -pooler; production uses the pooled endpoint.\n");
}

const STATEMENTS_PER_REQUEST = 15; // roughly the teacher inbox, the heaviest read
const REQUESTS = 40; // per round
const ROUNDS = 4; // off, on, off, on — alternating so a slow minute hits both sides
const uid = randomUUID();

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

async function round(enforce: boolean): Promise<number[]> {
  const pool = new ScopedPool({ connectionString: url, max: 4 }, enforce);
  try {
    await pool.query("select 1"); // connect before the clock starts
    const perRequest: number[] = [];
    await asUser({ userId: uid, role: "teacher" }, async () => {
      for (let r = 0; r < REQUESTS; r++) {
        const t0 = performance.now();
        for (let n = 0; n < STATEMENTS_PER_REQUEST; n++) {
          await pool.query("select count(*) from students where teacher_id = $1", [uid]);
        }
        perRequest.push(performance.now() - t0);
      }
    });
    return perRequest;
  } finally {
    await pool.end();
  }
}

const off: number[] = [];
const on: number[] = [];
for (let i = 0; i < ROUNDS; i++) {
  const enforce = i % 2 === 1;
  const times = await round(enforce);
  (enforce ? on : off).push(...times);
  console.log(`round ${i + 1}: enforce=${enforce}  median ${median(times).toFixed(1)} ms per ${STATEMENTS_PER_REQUEST}-statement request`);
}

const perStmt = (ms: number) => (ms / STATEMENTS_PER_REQUEST).toFixed(2);
const offMed = median(off), onMed = median(on), offP95 = p95(off), onP95 = p95(on);
console.log("\n               off          on          added");
console.log(`median / request  ${offMed.toFixed(1)} ms    ${onMed.toFixed(1)} ms    +${(onMed - offMed).toFixed(1)} ms`);
console.log(`p95    / request  ${offP95.toFixed(1)} ms    ${onP95.toFixed(1)} ms    +${(onP95 - offP95).toFixed(1)} ms`);
console.log(`per statement     ${perStmt(offMed)} ms    ${perStmt(onMed)} ms    +${perStmt(onMed - offMed)} ms`);
console.log(`\nInbox gate: added p95 per ${STATEMENTS_PER_REQUEST}-statement request should be <= 100 ms. This run: +${(onP95 - offP95).toFixed(1)} ms -> ${onP95 - offP95 <= 100 ? "WITHIN BUDGET" : "OVER BUDGET"}.`);
console.log("(Other routes: the gate is +25 %. Divide the added ms per statement by your typical ms per statement.)");
