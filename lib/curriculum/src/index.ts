/**
 * `@workspace/curriculum` — the Jordanian national curriculum catalog.
 *
 * Shared by the mobile app and the API server. The server needs it because
 * evaluation questions are generated and graded against learning objectives,
 * and neither may depend on what a client claims the curriculum contains.
 *
 * The per-book catalog modules are NOT re-exported here: `g10MathSem1` and
 * `g10MathSem2` both export `NccdKbUnit`, `NccdKbLesson`, `NccdBrowserUnit` and
 * `NccdBrowserLesson`, and ambiguous star exports are silently dropped rather
 * than reported. Import those from their own subpaths:
 *
 *   import { buildNccdSem1Catalog } from '@workspace/curriculum/catalogs/g10MathSem1';
 */
export * from './arabic.ts';
export * from './curriculumIds.ts';
export * from './catalog.ts';
export * from './blooms.ts';
export * from './objectives.ts';
export * from './sources.ts';
export * from './bank.ts';
// `passages.ts` is NOT re-exported. It reads the ~2.1 MB extracted corpus from
// disk with node:fs; the mobile app imports this package, so exporting it here
// would eventually put the whole corpus in a phone bundle. Server-side callers
// import '@workspace/curriculum/passages'.
