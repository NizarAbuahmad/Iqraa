import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique().notNull(),
  // Nullable: a Google-only account never sets one.
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  role: text("role").notNull().default("teacher"),
  emailVerified: boolean("email_verified").notNull().default(false),
  /**
   * Set by a moderator acting on a report — see `routes/moderation.ts`.
   *
   * Null is the only "not suspended" state; a timestamp is both the flag and
   * the record of when, so there is no boolean to fall out of step with a
   * date. `authMiddleware` re-reads the user on every request, so a
   * suspension takes effect on the next call rather than when a token
   * expires, and login refuses outright.
   *
   * Deliberately not a delete: ejection has to be reversible, because the
   * first thing a wrongly-suspended teacher needs is their class back.
   */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  /** Shown to the suspended person. Without it they only see a door that stopped opening. */
  suspendedReason: text("suspended_reason").notNull().default(""),
  /**
   * When this teacher confirmed their school holds the parental consent that
   * lets them enter student information here — see `lib/rosterConsent.ts`.
   *
   * On the teacher, not on each student row, and not on a class: a teacher
   * types thirty names in one sitting, and a per-name checkbox is a checkbox
   * nobody reads. Schools obtain consent in a blanket form, so one
   * attestation at the point of first entry is both the honest shape and the
   * one a teacher will actually take seriously.
   *
   * ponytail: per-teacher, not per-class. Move it to classGroups if a school
   * ever needs to say yes for one class and no for another.
   */
  rosterConsentAt: timestamp("roster_consent_at", { withTimezone: true }),
  /**
   * Which wording they agreed to. A consent record that cannot say what was
   * consented to is close to worthless when someone asks, and legal wording
   * changes more often than schemas do.
   */
  rosterConsentVersion: text("roster_consent_version").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
  emailVerified: true,
});

export const selectUserSchema = createSelectSchema(users);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
