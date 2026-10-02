import { pgTable, text, boolean, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
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
  /**
   * A key (not a URL) in the `iqraa-public` R2 bucket's `avatars/` prefix —
   * null means show initials. Stored as a key rather than the resolved URL so
   * `DELETE /auth/users/avatar` has something to hand `deletePublicObject`
   * without parsing one back out of a URL; the public, non-expiring URL is
   * computed from it at serialization time via `lib/r2.ts`'s `publicUrl`.
   */
  avatarKey: text("avatar_key"),
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
  /**
   * Grade and subject catalog ids (`@workspace/curriculum`'s GRADES/SUBJECTS)
   * this teacher picked at signup. Empty on every non-teacher account, and on
   * a teacher who hasn't completed setup yet — that emptiness is the signal
   * the mobile routing gate reads to send them to `/setup-subjects` (see
   * `needsTeacherSetup` in routeGating.ts). Editable afterwards from the
   * profile screen, never enforced server-side beyond validating the ids
   * exist in the catalog: this narrows what the curriculum browser shows by
   * default, it does not gate access to any grade/subject's content.
   */
  gradeIds: jsonb("grade_ids").$type<string[]>().notNull().default([]),
  subjectIds: jsonb("subject_ids").$type<string[]>().notNull().default([]),
  /**
   * What `gradeIds`/`subjectIds` can't say: which subjects go with which
   * grade. Those two stay in sync as the union across this array (every
   * gradeId that appears, every subjectId that appears anywhere) so
   * `needsTeacherSetup` and every screen reading the flat fields keep working
   * unchanged — this is the one place the actual pairing lives, read by
   * `app/(tabs)/curriculum.tsx` to narrow a selected grade to *its* subjects
   * instead of every subject the teacher has ever picked for any grade.
   */
  teachingAssignments: jsonb("teaching_assignments").$type<{ gradeId: string; subjectIds: string[] }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /**
   * One sign-in's whole chain of rotated tokens.
   *
   * `/auth/refresh` rotates: the token presented is retired and a new one
   * issued. Before this column that retirement was a DELETE, so a stolen token
   * replayed after the victim's client had already rotated simply found no row
   * and answered 401 — identical to an expired or made-up token. The theft was
   * invisible, and the thief's own token, minted at the rotation they won, kept
   * working for its full term.
   *
   * With a family id, a replay is recognisable: the row is still there and
   * carries a `rotatedAt`. That is a fact about a token that cannot happen
   * innocently, and the answer is to end every token descended from the same
   * sign-in — the legitimate client's included, because there is no way to tell
   * which of the two holders is the real one. Both get signed out; only one of
   * them can sign back in.
   */
  familyId: uuid("family_id").notNull().defaultRandom(),
  /**
   * When this token was exchanged for its successor. Null means live.
   *
   * Rows are kept past rotation rather than deleted, which is the whole
   * mechanism — a deleted row cannot tell you it was used twice. They are
   * pruned once expired (see `pruneExpiredRefreshTokens`), so the table's
   * steady-state size is one row per rotation within the token's lifetime, not
   * one per rotation ever.
   */
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
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

/**
 * DEPLOY NOTE — one-time backfill required alongside this table's push,
 * against production, before this deploy goes live:
 *
 *   UPDATE users SET email_verified = true
 *   WHERE password_hash IS NOT NULL AND email_verified = false;
 *
 * Login now refuses an unverified password account (see routes/auth.ts).
 * Every account created before this table existed has emailVerified=false
 * and no way to have earned true — skipping this locks out every existing
 * teacher. New registrations start false and verify through the code this
 * table stores; existing ones are grandfathered in once, here.
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // sha256 of the 6-digit code — never the code itself, same as the other token tables.
  codeHash: text("code_hash").notNull(),
  // Wrong-guess counter. A 6-digit code is only 1e6 possibilities, so this
  // caps brute-forcing one token far below its 15-minute expiry.
  attempts: integer("attempts").notNull().default(0),
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
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
