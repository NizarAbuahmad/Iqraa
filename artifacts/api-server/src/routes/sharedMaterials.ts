/**
 * `/shared/:code` — a teacher's saved material opened from its share link
 * (`https://app.iqrra.com/m/CODE`; spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md).
 *
 * Mounted at "/shared", so nothing here reaches another path. Three routes:
 *  - `GET /shared/:code` is public, like `/take/:code`: no account, the paper
 *    without its answers (a forwarded link can reach a student);
 *  - `GET /shared/:code/full` is a teacher's view, with the answers;
 *  - `POST /shared/:code/save` copies it into the calling teacher's own files.
 *
 * Every miss — malformed, unknown, stopped, or its material deleted — is the
 * same 404, so the endpoint does not say which codes ever existed. The code
 * walk is limited per IP, never on a header the caller controls.
 */
import { Router, type Response } from "express";

import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { createRateLimiter } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import { copySharedMaterial, loadSharedMaterial } from "../lib/sharedMaterial.ts";
import { toClientItem } from "./workspace.ts";

const router = Router();

router.use(createRateLimiter({ windowMs: 60_000, max: 120, name: "shared-material" }));

const NOT_FOUND = { error: "Not found" };

function fail(res: Response, err: unknown, action: string): void {
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: "Could not open the shared material" });
}

router.get("/:code", async (req, res) => {
  try {
    const material = await loadSharedMaterial(req.params["code"], { full: false });
    if (!material) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.json({ material, full: false });
  } catch (err) {
    fail(res, err, "open shared material");
  }
});

router.get("/:code/full", authMiddleware, requireRole(...TEACHER_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const material = await loadSharedMaterial(req.params["code"], { full: true });
    if (!material) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.json({ material, full: true });
  } catch (err) {
    fail(res, err, "open shared material (full)");
  }
});

router.post("/:code/save", authMiddleware, requireRole(...TEACHER_ROLES), async (req: AuthenticatedRequest, res) => {
  try {
    const copy = await copySharedMaterial(req.params["code"], req.user!.id);
    if (!copy) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.status(201).json({ item: toClientItem(copy) });
  } catch (err) {
    fail(res, err, "save shared material");
  }
});

export default router;
