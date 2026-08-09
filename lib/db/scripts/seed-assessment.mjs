/**
 * Seed the assessment configuration: the four competencies and the default
 * level scale with its bands.
 *
 * Idempotent — safe to run on every deploy. Rows are matched on their natural
 * key (competency `key`, the default scale's name) and updated in place, so
 * re-running never duplicates and never clobbers a school's edited thresholds
 * with the defaults.
 *
 *   node lib/db/scripts/seed-assessment.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

delete process.env.DATABASE_URL;
loadEnvFile(path.join(workspaceRoot, ".env"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to the repo-root .env, then retry.");
  process.exit(1);
}

const COMPETENCIES = [
  {
    key: "knowledge",
    labelAr: "المعرفة",
    labelEn: "Knowledge",
    bloomsLevels: ["Remember"],
    sortOrder: 1,
  },
  {
    key: "understanding",
    labelAr: "الفهم",
    labelEn: "Understanding",
    bloomsLevels: ["Understand"],
    sortOrder: 2,
  },
  {
    key: "application",
    labelAr: "التطبيق",
    labelEn: "Application",
    bloomsLevels: ["Apply"],
    sortOrder: 3,
  },
  {
    key: "critical_thinking",
    labelAr: "التفكير الناقد",
    labelEn: "Critical Thinking",
    bloomsLevels: ["Analyze", "Evaluate", "Create"],
    sortOrder: 4,
  },
];

const DEFAULT_SCALE_NAME = "Iqraa default";

/** Bands tile 0–100 with an inclusive lower bound and no gaps. */
const BANDS = [
  {
    key: "beginner",
    labelAr: "مبتدئ",
    labelEn: "Beginner",
    descriptorAr: "فجوات جوهرية في المعرفة الأساسية",
    descriptorEn: "Significant gaps in foundational knowledge",
    minPercent: 0,
    maxPercent: 49.99,
    sortOrder: 1,
  },
  {
    key: "developing",
    labelAr: "نامٍ",
    labelEn: "Developing",
    descriptorAr: "يفهم بعض المفاهيم ويحتاج إلى دعم",
    descriptorEn: "Understands some concepts but requires support",
    minPercent: 50,
    maxPercent: 69.99,
    sortOrder: 2,
  },
  {
    key: "proficient",
    labelAr: "متمكّن",
    labelEn: "Proficient",
    descriptorAr: "يحقّق نتاجات التعلّم المتوقّعة لصفّه",
    descriptorEn: "Meets the expected grade-level learning objectives",
    minPercent: 70,
    maxPercent: 84.99,
    sortOrder: 3,
  },
  {
    key: "advanced",
    labelAr: "متقدّم",
    labelEn: "Advanced",
    descriptorAr: "فهم عميق وتطبيق مستقل للمفاهيم",
    descriptorEn: "Demonstrates strong understanding and applies concepts independently",
    minPercent: 85,
    maxPercent: 100,
    sortOrder: 4,
  },
];

/**
 * An average hides holes, so the level can be capped when a specific competency
 * is weak. You cannot be Proficient in a topic whose facts you don't have, and
 * Advanced is a claim about independent reasoning — without evidence of
 * reasoning, the scale declines to make it.
 */
const DEMOTION_RULES = {
  capAtDevelopingIfBelow: { knowledge: 50 },
  capAtDevelopingIfWeakCompetencies: 2,
  capAtProficientIfInsufficient: ["critical_thinking"],
};

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const c of COMPETENCIES) {
      await client.query(
        `INSERT INTO competency_definitions (key, label_ar, label_en, blooms_levels, sort_order)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (key) DO UPDATE SET
           label_ar = EXCLUDED.label_ar,
           label_en = EXCLUDED.label_en,
           blooms_levels = EXCLUDED.blooms_levels,
           sort_order = EXCLUDED.sort_order`,
        [c.key, c.labelAr, c.labelEn, JSON.stringify(c.bloomsLevels), c.sortOrder],
      );
    }

    // The default scale is matched by name within system scope. Editing its
    // bands afterwards is a supported admin action, so this only inserts.
    const existing = await client.query(
      `SELECT id FROM level_scales WHERE scope = 'system' AND name = $1 LIMIT 1`,
      [DEFAULT_SCALE_NAME],
    );

    let scaleId = existing.rows[0]?.id;
    if (!scaleId) {
      const inserted = await client.query(
        `INSERT INTO level_scales (name, scope, is_default, version, demotion_rules)
         VALUES ($1, 'system', true, 1, $2::jsonb)
         RETURNING id`,
        [DEFAULT_SCALE_NAME, JSON.stringify(DEMOTION_RULES)],
      );
      scaleId = inserted.rows[0].id;
      console.log(`Created default level scale ${scaleId}`);
    } else {
      console.log(`Default level scale already present (${scaleId}) — bands left as-is`);
    }

    for (const b of BANDS) {
      await client.query(
        `INSERT INTO level_bands
           (scale_id, key, label_ar, label_en, descriptor_ar, descriptor_en,
            min_percent, max_percent, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (scale_id, key) DO NOTHING`,
        [
          scaleId,
          b.key,
          b.labelAr,
          b.labelEn,
          b.descriptorAr,
          b.descriptorEn,
          b.minPercent,
          b.maxPercent,
          b.sortOrder,
        ],
      );
    }

    await client.query("COMMIT");

    const counts = await client.query(
      `SELECT
         (SELECT count(*) FROM competency_definitions) AS competencies,
         (SELECT count(*) FROM level_scales) AS scales,
         (SELECT count(*) FROM level_bands WHERE scale_id = $1) AS bands`,
      [scaleId],
    );
    const { competencies, scales, bands } = counts.rows[0];
    console.log(`Seeded: ${competencies} competencies, ${scales} scale(s), ${bands} bands`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
