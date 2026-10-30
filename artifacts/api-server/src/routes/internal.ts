/**
 * Server-to-server endpoints a scheduler calls. The caller is Cloud Scheduler,
 * which holds a shared key, not a user session — so no auth middleware.
 *
 * Guarded by `x-internal-key` against INTERNAL_CRON_KEY, compared in constant
 * time. A wrong, missing or UNSET key answers 404 — the route does not exist
 * for anyone else, the same posture as /site/signups. Unset is closed: until
 * the secret is created and attached to the service (docs/deploying.md,
 * «The homework reminder»), neither job runs: the homework reminder and the
 * homework-submission orphan sweep share this one key.
 *
 * No `router.use` here, and this router is mounted WITH a path prefix
 * (`router.use("/internal", internalRouter)`): a bare middleware at the root
 * of /api would run for every request (see mountOrder.test.ts), and the spec
 * requires a prefix.
 */
import { Router } from "express";
import { siteKeyMatches } from "../lib/adminMetrics.js";
import { logger } from "../lib/logger";
import { runHomeworkReminders } from "../lib/homeworkReminders.ts";
import { sweepSubmissionOrphans } from "../lib/homeworkSubmissionSweep.ts";
import { parseSweepQuery } from "../modules/homework/submissionSweep.ts";

const router = Router();

// The orphan sweep deletes a minor's photos for good, so a mistaken call must cost nothing: it
// previews (reports what would go, changes nothing) whenever `dryRun` is present in any form but an
// exact `0` / `false`, and refuses any other query key, so a typo cannot become a real run
// (parseSweepQuery). The limits (grace period, cap per run) are constants in the sweep; the
// request cannot override them.
router.post("/homework-submission-sweep", async (req, res) => {
  // The key guard comes first: an unauthenticated caller sees a 404 whatever the query says.
  if (!siteKeyMatches(process.env.INTERNAL_CRON_KEY, req.headers["x-internal-key"])) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const query = parseSweepQuery(req.query);
  if (!query.ok) {
    res.status(400).json({ error: "Unknown query parameter" });
    return;
  }
  const { dryRun } = query;
  try {
    // All the work finishes before the response: Cloud Run throttles CPU once it is sent.
    const run = await sweepSubmissionOrphans({ now: new Date(), dryRun });
    // The line docs/deploying.md tells the owner to look for.
    logger.info(run, "homework submission sweep run");
    res.json(run);
  } catch (err) {
    logger.error({ err }, "homework submission sweep failed");
    res.status(500).json({ error: "Failed to sweep homework submissions" });
  }
});

router.post("/homework-reminders", async (req, res) => {
  // siteKeyMatches is a generic constant-time shared-key check, named for its first user.
  if (!siteKeyMatches(process.env.INTERNAL_CRON_KEY, req.headers["x-internal-key"])) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const run = await runHomeworkReminders(new Date());
    // The line docs/deploying.md tells the owner to look for.
    logger.info(run, "homework reminders run");
    res.json(run);
  } catch (err) {
    logger.error({ err }, "homework reminders failed");
    res.status(500).json({ error: "Failed to send homework reminders" });
  }
});

export default router;
