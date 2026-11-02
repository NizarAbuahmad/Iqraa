/**
 * What this guards: tearing a test database down must not make the test process
 * fail. `pool.end()` resolves once each idle client's `end()` has been *started*,
 * not when its goodbye has reached the server. `dropDatabase` then runs `DROP
 * DATABASE … WITH (FORCE)`, which kills every session still on the database; a
 * client the force got to before the server had read its goodbye is told
 * «terminating connection due to administrator command», and pg-pool re-emits
 * that on the pool. Nobody listens, so Node raises an uncaughtException and the
 * test FILE is marked failed after every test in it passed (seen in CI on
 * homeworkSubmission.db.test.ts: «Test hook "before" … generated asynchronous
 * activity after the test ended»).
 *
 * On a quiet machine the drop's own connection set-up takes long enough for the
 * goodbyes to land first, so the race is rare there and a loop of teardowns
 * proves little. This test holds the goodbyes in flight instead: the pool talks
 * to Postgres through a small proxy that delays client→server bytes, which is
 * what a starved CI runner does to them. The race is then lost every time unless
 * the teardown waits for the sessions to close before it forces the drop.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import pg from "pg";

import { describeDb } from "../gate.ts";
import { closeAndDropTestDb } from "../testDb.ts";
import { assertSafeAdminUrl, newTestDbName, urlForDatabase } from "../testDbRules.ts";

/** How long the proxy holds each client→server chunk once `slow` is on. */
const HOLD_MS = 400;
const TEARDOWNS = 3;

interface DelayProxy {
  port: number;
  /** While on, bytes from clients reach the server `HOLD_MS` late (order kept). */
  slow(on: boolean): void;
  close(): Promise<void>;
}

async function startDelayProxy(upstreamHost: string, upstreamPort: number): Promise<DelayProxy> {
  let slow = false;
  const sockets = new Set<net.Socket>();
  // allowHalfOpen: pg half-closes right after its goodbye and keeps reading; a proxy that hung
  // up on the client at that FIN would hide the server's reply, and with it the failure.
  const server = net.createServer({ allowHalfOpen: true }, client => {
    const upstream = net.connect({ port: upstreamPort, host: upstreamHost, allowHalfOpen: true });
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("error", () => {});
      s.on("close", () => sockets.delete(s));
    }
    // Same delay for every chunk and for the half-close, so their order is kept.
    const later = (fn: () => void) => (slow ? void setTimeout(fn, HOLD_MS) : fn());
    client.on("data", d => later(() => upstream.write(d)));
    client.on("end", () => later(() => upstream.end()));
    upstream.on("data", d => client.write(d));
    upstream.on("end", () => client.end());
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    slow: on => {
      slow = on;
    },
    close: () =>
      new Promise<void>(resolve => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

describeDb("tearing a test database down", () => {
  it("does not force-drop a database whose connections are still saying goodbye", async () => {
    const admin = assertSafeAdminUrl(process.env.TEST_DATABASE_URL!);
    const adminPool = new pg.Pool({ connectionString: admin.toString(), max: 1 });
    const proxy = await startDelayProxy(admin.hostname === "[::1]" ? "::1" : admin.hostname, Number(admin.port || 5432));
    const viaProxy = new URL(admin.toString());
    viaProxy.hostname = "127.0.0.1";
    viaProxy.port = String(proxy.port);
    const errors: string[] = [];
    try {
      for (let i = 0; i < TEARDOWNS; i++) {
        const name = newTestDbName();
        await adminPool.query(`CREATE DATABASE ${name}`);
        const pool = new pg.Pool({ connectionString: urlForDatabase(viaProxy, name), max: 4 });
        pool.on("error", e => errors.push(`${name}: ${e.message}`));
        // Four overlapping queries, so the pool holds four idle clients, as a test file's does.
        await Promise.all([1, 2, 3, 4].map(() => pool.query("SELECT pg_sleep(0.005)")));

        proxy.slow(true); // their goodbyes will now reach the server late
        await closeAndDropTestDb(pool, admin, name);
        proxy.slow(false);

        // A late socket error arrives a few milliseconds after the drop returns.
        await new Promise(r => setTimeout(r, 30));
      }
    } finally {
      await adminPool.end();
      await proxy.close();
    }
    assert.deepEqual(errors, [], `${errors.length} client(s) were killed by the force-drop instead of closing`);
  });
});
