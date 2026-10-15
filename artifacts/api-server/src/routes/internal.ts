/**
 * Server-to-server endpoints a scheduler calls. The caller is Cloud Scheduler,
 * which holds a shared key, not a user session — so no auth middleware.
 *
 * Guarded by `x-internal-key` against INTERNAL_CRON_KEY, compared in constant
 * time. A wrong, missing or UNSET key answers 404 — the route does not exist
 * for anyone else, the same posture as /site/signups. Unset is closed: until
 * the secret is created and attached to the service (docs/deploying.md,
 * «The homework reminder»), the reminder never runs.
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

const router = Router();

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
