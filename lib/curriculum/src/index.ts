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
export * from './catalog.ts';
export * from './objectives.ts';
