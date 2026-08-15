import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  users,
  refreshTokens,
  passwordResetTokens,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return secret;
}

function generateTokens(userId: string, email: string, role: string) {
  const secret = getSecret();
  const accessToken = jwt.sign(
    { sub: userId, email, role, type: "access" },
    secret,
    { expiresIn: "15m" },
  );
  const refreshTokenValue = crypto.randomBytes(48).toString("hex");
  return { accessToken, refreshTokenValue };
}

async function storeRefreshToken(userId: string, tokenValue: string): Promise<void> {
  const tokenHash = crypto
    .createHash("sha256")
    .update(tokenValue)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!firstName?.trim()) {
      res.status(400).json({ error: "First name is required" });
      return;
    }
    if (!lastName?.trim()) {
      res.status(400).json({ error: "Last name is required" });
      return;
    }
    if (!email?.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    // Check duplicate email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "teacher",
        preferredLanguage: "en",
      })
      .returning();

    if (!user) throw new Error("Failed to create user");

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    logger.error({ err }, "register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Update last_login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    logger.error({ err }, "login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "logout failed");
    res.status(500).json({ error: "Logout failed" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Rotate: delete old, issue new
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.json({ accessToken, refreshToken: refreshTokenValue });
  } catch (err) {
    logger.error({ err }, "refresh failed");
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// GET /auth/me
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    logger.error({ err }, "get profile failed");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ ok: true });
      return;
    }

    const resetTokenValue = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetTokenValue)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // In local development only, log the token so engineers can test the flow
    // without a real email service. Never log tokens in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[AUTH:dev] Password reset requested for ${user.email} — token expires ${expiresAt.toISOString()}`,
        `\n[AUTH:dev] Reset token (redacted in prod): ${resetTokenValue}`,
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "forgot password failed");
    res.status(500).json({ error: "Failed to process request" });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token) {
      res.status(400).json({ error: "Reset token is required" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [stored] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, stored.userId));

    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, stored.id));

    // Revoke all refresh tokens on password reset
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, stored.userId));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset password failed");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// PATCH /users/profile
router.patch("/users/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { preferredLanguage, firstName, lastName } = req.body as {
      preferredLanguage?: string;
      firstName?: string;
      lastName?: string;
    };

    const updates: Record<string, unknown> = {};
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;
    if (firstName?.trim()) updates.firstName = firstName.trim();
    if (lastName?.trim()) updates.lastName = lastName.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      role: updated.role,
      preferredLanguage: updated.preferredLanguage,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "update profile failed");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
