// CHANGING ANYTHING IN THIS DIRECTORY DOES NOT DEPLOY IT.
//
// The tables come from `pnpm --filter @workspace/db run push`, run by hand
// against the production DATABASE_URL. It is deliberately not wired into the
// Render build — drizzle-kit resolves drift by dropping columns, and a deploy
// is the wrong place to discover that (see the header of render.yaml).
//
// So: add a table here, run the push, and confirm it with
// `pnpm --filter @workspace/db run verify-schema`. Skipping it ships endpoints
// that answer 503 — on 2026-08-19 that went unnoticed until 14 of 24 tables
// were absent from production.
//
// CI asks about it: a PR touching this directory fails until its description
// carries `schema-push: done` or `schema-push: n/a`.

// Export your models here. Add one export per file
export * from "./conversations";
export * from "./messages";
export * from "./users";
export * from "./savedMaterials";

// Student level evaluation — see docs/student-evaluation-module-plan.md
export * from "./students";
export * from "./assessmentConfig";
export * from "./evaluations";
export * from "./attempts";
export * from "./feedback";

// AI spend + cache-hit measurement — see docs/ai-cost-savings-plan.md
export * from "./aiGenerations";
// The shared variant pool those keys are looked up in (plan phase 1)
export * from "./aiArtifacts";

// Teacher-uploaded lesson attachments (R2-backed) — see routes/lessonMedia.ts
export * from "./lessonMedia";

// Person-to-person chat — teacher/parent/student threads and groups. Not the
// AI chatbot (that's ./conversations + ./messages) — see routes/messaging.ts
export * from "./messaging";
