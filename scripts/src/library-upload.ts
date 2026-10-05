/**
 * Publish a staging folder to the resources library.
 *
 *   IQRAA_API_URL=https://… IQRAA_ADMIN_EMAIL=… IQRAA_ADMIN_PASSWORD=… \
 *     pnpm --filter @workspace/scripts run library-upload ./staging/manifest.json [--dry-run]
 *
 * The manifest is a JSON array of ManifestEntry (see libraryManifest.ts); `file`
 * paths are relative to the manifest. Each published entry gets its library `id`
 * written back into the manifest, and an entry that already has one is skipped,
 * so a re-run after a failure never publishes twice. The id is also what
 * `DELETE /library/:id` takes if something has to come back out.
 *
 * Needs a `system_admin` account (the library is global). The access token lasts
 * 15 minutes, so this signs in with the password and signs in again on a 401.
 * Credentials come from the environment only and are never printed.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { checkEntry, dedupeKey, fileQuery, linkBody, type ManifestEntry } from "./libraryManifest.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const manifestPath = args.find(a => !a.startsWith("--"));
const base = process.env.IQRAA_API_URL?.replace(/\/+$/, "");
const email = process.env.IQRAA_ADMIN_EMAIL;
const password = process.env.IQRAA_ADMIN_PASSWORD;

if (!manifestPath || !base || (!dryRun && (!email || !password))) {
  console.error("usage: library-upload <manifest.json> [--dry-run]");
  console.error("env:   IQRAA_API_URL, IQRAA_ADMIN_EMAIL, IQRAA_ADMIN_PASSWORD (not needed for --dry-run)");
  process.exit(2);
}

let token = "";
async function signIn(): Promise<void> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
  token = ((await res.json()) as { accessToken: string }).accessToken;
}

/** One authenticated request; a 401 means the 15-minute token lapsed, so sign in and retry once. */
async function api(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const send = () => fetch(`${base}/api${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
  let res = await send();
  if (res.status === 401) {
    await signIn();
    res = await send();
  }
  return res;
}

const dir = dirname(resolve(manifestPath));
const entries = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestEntry[];
if (!Array.isArray(entries)) throw new Error("manifest must be a JSON array");

// What the library already holds, per grade, fetched lazily (live runs only).
const existing = new Map<string, Set<string>>();
async function alreadyPublished(e: ManifestEntry): Promise<boolean> {
  if (!existing.has(e.gradeId)) {
    const res = await api(`/library?gradeId=${encodeURIComponent(e.gradeId)}`, { method: "GET" });
    if (!res.ok) throw new Error(`could not read the library for ${e.gradeId} (${res.status})`);
    const rows = (await res.json()) as { gradeId: string; lessonId: string | null; category: string; titleAr: string }[];
    existing.set(e.gradeId, new Set(rows.map(dedupeKey)));
  }
  return existing.get(e.gradeId)!.has(dedupeKey(e));
}

if (!dryRun) await signIn();

const tally = { uploaded: 0, skipped: 0, failed: 0 };
for (const [i, entry] of entries.entries()) {
  const label = `#${i + 1} ${entry.titleAr ?? "(no title)"}`;
  const skip = (why: string) => {
    tally.skipped++;
    console.log(`skip   ${label} — ${why}`);
  };
  const fail = (why: string) => {
    tally.failed++;
    console.log(`FAIL   ${label} — ${why}`);
  };

  if (entry.id) {
    skip("already published");
    continue;
  }
  const filePath = entry.file ? resolve(dir, entry.file) : undefined;
  const size = filePath ? await stat(filePath).then(s => s.size, () => -1) : undefined;
  if (size === -1) {
    fail(`file not found: ${entry.file}`);
    continue;
  }
  const checked = checkEntry(entry, size);
  if (!checked.ok) {
    fail(checked.error);
    continue;
  }
  if (dryRun) {
    console.log(`ok     ${label} — would publish as ${checked.kind} (${entry.category}, ${entry.gradeId}/${entry.subjectId})`);
    continue;
  }

  try {
    if (await alreadyPublished(entry)) {
      skip("the library already has this title");
      continue;
    }
    const res =
      checked.kind === "link"
        ? await api("/library/link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(linkBody(entry)),
          })
        : await api(`/library/file?${fileQuery(entry)}`, {
            method: "POST",
            headers: { "content-type": checked.mime },
            body: await readFile(filePath!),
          });
    if (res.status !== 201) {
      const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error;
      fail(`${res.status} ${msg ?? ""}`.trim());
      continue;
    }
    entry.id = ((await res.json()) as { id: string }).id;
    tally.uploaded++;
    console.log(`up     ${label} — ${entry.id}`);
    // Written after every upload so a crash mid-run still remembers what went out.
    await writeFile(manifestPath, JSON.stringify(entries, null, 2) + "\n", "utf8");
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

console.log(`\n${dryRun ? "dry run: " : ""}${tally.uploaded} uploaded, ${tally.skipped} skipped, ${tally.failed} failed`);
// exitCode, not process.exit(): exiting while fetch's sockets are still closing aborts Node on Windows.
process.exitCode = tally.failed ? 1 : 0;
