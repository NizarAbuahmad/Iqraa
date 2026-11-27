/**
 * POST /usage/heartbeat — "this person is still here, in this area of the app".
 *
 * The app sends one about every 60 s while it is in the foreground and has been touched in the
 * last two minutes (mobile hooks/useUsageHeartbeat.ts). Each counted beat adds one minute to the
 * caller's own `usage_minutes` row for (Amman day, area, platform); a beat that arrives less than
 * HEARTBEAT_MIN_GAP_SECONDS after the person's last counted beat — in ANY area or platform —
 * counts nothing, so a looping or malicious client cannot inflate the admin insights page.
 *
 * Any signed-in role. The body carries only an area name from a closed list (`USAGE_AREAS`);
 * the platform is the X-Iqraa-Platform header every app request already carries. Answers 204 and
 * nothing else — the client drops failures and never retries.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { ammanDay } from "../lib/dailyActivity.js";
import { HEARTBEAT_MIN_GAP_SECONDS, normalizeArea, normalizePlatform } from "../lib/usageAreas.js";

const router = Router();

router.post("/usage/heartbeat", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const area = normalizeArea((req.body as { area?: unknown } | undefined)?.area);
  const header = req.headers["x-iqraa-platform"];
  const platform = normalizePlatform(typeof header === "string" ? header : null);
  try {
    // The gap is per PERSON, not per row: a client cycling areas or X-Iqraa-Platform values (or a
    // phone and a web tab open at once) still earns one minute per real minute. Any of the
    // person's rows beaten in the last gap — today's or yesterday's, across midnight — skips this one.
    const userId = req.user!.id;
    const day = ammanDay(new Date());
    await db.execute(sql`
      insert into usage_minutes (user_id, day, area, platform, minutes, last_beat_at)
      select ${userId}, ${day}, ${area}, ${platform}, 1, now()
      where not exists (
        select 1 from usage_minutes
        where user_id = ${userId}
          and day >= ${day}::date - 1
          and last_beat_at > now() - make_interval(secs => ${HEARTBEAT_MIN_GAP_SECONDS})
      )
      on conflict (user_id, day, area, platform) do update
        set minutes = usage_minutes.minutes + 1, last_beat_at = now()`);
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "usage heartbeat failed");
    res.status(500).json({ error: "Failed to record usage" });
  }
});

export default router;
