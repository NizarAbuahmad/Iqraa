/**
 * Assessment configuration — competencies and level thresholds.
 *
 * These are tables rather than TypeScript constants because the brief requires
 * thresholds to be configurable by an admin instead of hard-coded, and because
 * the competency list has to be expandable later. A pgEnum would need a
 * migration to add a value; text plus a lookup table does not.
 *
 * Scales are **versioned, and each attempt stores a snapshot** of the scale it
 * was graded against (see `attempts.levelScaleSnapshot`). Without that, editing
 * a threshold would silently rewrite the level of every past result — a student
 * who was Proficient in October becomes Developing in March with no record of
 * why, and the teacher has no way to tell the change from a regression.
 */
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

/** Who owns a scale. 'system' rows are seeded and shared. */
export type LevelScaleScope = "system" | "school" | "teacher";

/** The four levels the brief names. Text, so a scale can add its own later. */
export type LevelKey = "beginner" | "developing" | "proficient" | "advanced";

/** Competency keys seeded at install. Text for the same reason. */
export type CompetencyKey =
  | "knowledge"
  | "understanding"
  | "application"
  | "critical_thinking";

export const competencyDefinitions = pgTable("competency_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").$type<CompetencyKey>().notNull().unique(),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en").notNull(),
  /**
   * Bloom's levels that map onto this competency. Used to seed a generation
   * target and to sanity-check a question's declared competency — not as the
   * sole source, because most catalog objectives carry a defaulted Bloom's
   * level (see `bloomsSource` in @workspace/curriculum).
   */
  bloomsLevels: jsonb("blooms_levels").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const levelScales = pgTable(
  "level_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    scope: text("scope").$type<LevelScaleScope>().notNull().default("system"),
    /** Null for 'system' scope. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    version: integer("version").notNull().default(1),
    /**
     * Demotion rules — an average hides holes, so a scale can cap the level when
     * a specific competency is weak. Shape:
     *   { capAtDevelopingIfBelow: { knowledge: 50 },
     *     capAtProficientIfInsufficient: ['critical_thinking'],
     *     capAtDevelopingIfWeakCompetencies: 2 }
     * Defaults live in the seed; see the scoring module for how they apply.
     */
    demotionRules: jsonb("demotion_rules").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("level_scales_owner_idx").on(t.ownerId)],
);

/**
 * Bands must tile 0–100 with no gap and no overlap, with an inclusive lower
 * bound. That invariant is enforced in the service layer and covered by tests —
 * a gap means a percentage that resolves to no level at all, which surfaces to a
 * teacher as a blank where the student's level should be.
 */
export const levelBands = pgTable(
  "level_bands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scaleId: uuid("scale_id")
      .notNull()
      .references(() => levelScales.id, { onDelete: "cascade" }),
    key: text("key").$type<LevelKey>().notNull(),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    descriptorAr: text("descriptor_ar").notNull().default(""),
    descriptorEn: text("descriptor_en").notNull().default(""),
    minPercent: numeric("min_percent", { precision: 5, scale: 2 }).notNull(),
    maxPercent: numeric("max_percent", { precision: 5, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  t => [
    unique("level_bands_scale_key_unique").on(t.scaleId, t.key),
    index("level_bands_scale_idx").on(t.scaleId),
  ],
);

/** Reusable rubrics a teacher can attach to open-ended questions. */
export const rubricTemplates = pgTable(
  "rubric_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull().default(""),
    criteria: jsonb("criteria").$type<unknown[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("rubric_templates_owner_idx").on(t.ownerId)],
);

export const insertLevelScaleSchema = createInsertSchema(levelScales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLevelBandSchema = createInsertSchema(levelBands).omit({ id: true });

export type CompetencyDefinition = typeof competencyDefinitions.$inferSelect;
export type LevelScale = typeof levelScales.$inferSelect;
export type InsertLevelScale = z.infer<typeof insertLevelScaleSchema>;
export type LevelBand = typeof levelBands.$inferSelect;
export type InsertLevelBand = z.infer<typeof insertLevelBandSchema>;
export type RubricTemplate = typeof rubricTemplates.$inferSelect;
