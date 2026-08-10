import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { verifyDerivative } from "../lib/mathVerifierClient.ts";
import { isVerifierUnreachable } from "../lib/derivativeVerified.ts";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Is the SymPy verifier actually reachable from this API?
 *
 * Deliberately a separate endpoint from /healthz: Render's health check points
 * at /healthz, and folding a cross-service call into it would let a sleeping
 * verifier take the API down with it.
 *
 * Public and unauthenticated on purpose. Whether the verifier is deployed is
 * the first thing anyone debugging this needs to know, and requiring a login to
 * find out is what made it invisible for as long as it was. The probe sends a
 * fixed trivial derivative and reports reachability, never a caller's input.
 */
router.get("/healthz/verifier", async (_req, res) => {
  const check = await verifyDerivative("x^2", "2x");
  if (isVerifierUnreachable(check.error)) {
    res.status(503).json({
      verifier: "unreachable",
      detail: check.error,
      hint: "MATH_VERIFIER_URL unset or the iqraa-verifier service is not deployed.",
    });
    return;
  }
  res.json({
    verifier: "ok",
    // A reachable verifier that disagrees about 2x is broken in a different,
    // louder way — surface it rather than reporting a bare "ok".
    selfTest: check.verified ? "pass" : "fail",
  });
});

export default router;
