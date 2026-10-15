// The tables deploy as MIGRATIONS (since 2026-10-08), not `push`.
//
// Edit a file here, run `pnpm --filter @workspace/db run generate`, and commit
// `lib/db/migrations/`. CI fails a schema edit with no migration, applies every
// migration to an empty Postgres, and holds destructive SQL until the PR body
// says `destructive-migration: ok`. See "Schema" in docs/deploying.md.

// Export your models here. Add one export per file
export * from "./conversations";
export * from "./messages";
export * from "./schools";
export * from "./users";
export * from "./savedMaterials";

// Student level evaluation — see docs/student-evaluation-module-plan.md
export * from "./students";
export * from "./teachingPlans";
// A teacher's own weekly period timetable — see schedule.ts.
export * from "./schedule";
// Homework a teacher sets for a class, and who has ticked it off — see homework.ts
export * from "./homework";
export * from "./assessmentConfig";
export * from "./evaluations";
export * from "./attempts";
export * from "./feedback";

// AI spend + cache-hit measurement — see docs/ai-cost-savings-plan.md
export * from "./aiGenerations";
// The shared variant pool those keys are looked up in (plan phase 1)
export * from "./aiArtifacts";
// A teacher's report against a pooled artifact — see aiArtifactReports.ts
export * from "./aiArtifactReports";

// Teacher-uploaded lesson attachments (R2-backed) — see routes/lessonMedia.ts
export * from "./lessonMedia";

// What a teacher put in front of a class from the Library — see classResources.ts
export * from "./classResources";
// Staff-uploaded resources library, per grade/subject/lesson — see routes/library.ts
export * from "./libraryResources";

// Person-to-person chat — teacher/parent/student threads and groups. Not the
// AI chatbot (that's ./conversations + ./messages) — see routes/messaging.ts
export * from "./messaging";
// Log of parent letters sent/shared/copied per student — see parentContacts.ts
export * from "./parentContacts";

// Rate-limit counters, shared across instances — see lib/rateLimit.ts
export * from "./rateLimits";

// Admin dashboard: hand-entered growth numbers + iqrra.com signups — see adminMetrics.ts
export * from "./adminMetrics";
