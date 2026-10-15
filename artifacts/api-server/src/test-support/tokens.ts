/**
 * Access tokens for tests. authMiddleware verifies an HS256 token with type
 * "access", then re-reads the user row — role and email come from the database,
 * never the token — so `sub` is the only claim that matters.
 */
import jwt from "jsonwebtoken";

import { TEST_SESSION_SECRET } from "./env.ts";

export function accessToken(userId: string, secret: string = TEST_SESSION_SECRET): string {
  return jwt.sign({ sub: userId, email: "", role: "ignored-by-server", type: "access" }, secret, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
}
