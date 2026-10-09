/**
 * What this guards: a password reset must end every session, even one whose
 * refresh is in flight at that moment.
 *
 * `/auth/refresh` used to retire the presented token and insert its successor
 * as two separate statements. A reset landing between them deleted every row
 * it could see, then the successor was inserted, and the session the reset
 * meant to end carried on.
 *
 * The fix is lock ordering on the user row: the refresh takes `FOR SHARE` on it
 * inside one transaction with the retire and the insert, and every revocation
 * that updates the user row does its update and its token delete in one
 * transaction. Checked by hand against Postgres 17 in both orders (refresh
 * first: the reset's delete sees the successor; reset first: the refresh finds
 * its row gone). Unit tests here have no database and `routes/auth.ts` cannot
 * be imported without one, so this pins the shape in the source instead —
 * crude, but it fails the day someone splits the transaction back apart.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(path.resolve(here, "..", f), "utf8").replace(/\r\n/g, "\n");

/** The source of one route handler: from its declaration to the next route. */
function handler(src: string, start: string): string {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `route not found: ${start}`);
  const next = src.slice(from + start.length).search(/\nrouter\.(get|post|put|patch|delete)\(/);
  return next < 0 ? src.slice(from) : src.slice(from, from + start.length + next);
}

describe("refresh rotation vs password reset", () => {
  const auth = read("auth.ts");

  it("/auth/refresh locks the user row, retires and issues in one transaction", () => {
    const h = handler(auth, 'router.post("/refresh"');
    const tx = h.indexOf("db.transaction(");
    const lock = h.indexOf('.for("share")');
    const retire = h.search(/tx\s*\.update\(refreshTokens\)/);
    const issue = h.search(/storeRefreshToken\([^)]*,\s*tx\)/);
    assert.ok(tx >= 0, "no transaction");
    assert.ok(lock > tx, "user row not locked inside the transaction");
    assert.ok(retire > lock, "retire is not on tx after the lock");
    assert.ok(issue > retire, "successor not inserted on tx");
    assert.doesNotMatch(h, /await db\s*\.update\(refreshTokens\)/);
  });

  it("/auth/reset-password updates the user and deletes tokens in one transaction", () => {
    const h = handler(auth, 'router.post("/reset-password"');
    const tx = h.indexOf("db.transaction(");
    assert.ok(tx >= 0, "no transaction");
    assert.ok(h.indexOf("tx.update(users)") > tx);
    assert.ok(h.indexOf("tx.delete(refreshTokens)") > h.indexOf("tx.update(users)"));
    assert.doesNotMatch(h, /db\.delete\(refreshTokens\)/);
  });

  it("admin set-password updates the user and deletes tokens in one transaction", () => {
    const admin = read("admin.ts");
    const at = admin.indexOf("canAdminSetPassword(req.user!.role, target)");
    assert.ok(at >= 0);
    const h = admin.slice(at, admin.indexOf("admin set user password", at));
    const tx = h.indexOf("db.transaction(");
    assert.ok(tx >= 0, "no transaction");
    assert.ok(h.indexOf("tx.update(users)") > tx);
    assert.ok(h.indexOf(".delete(refreshTokens)") > h.indexOf("tx.update(users)"));
    assert.doesNotMatch(h, /db\s*\.delete\(refreshTokens\)/);
  });
});
