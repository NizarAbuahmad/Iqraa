/**
 * Re-export shim — the real module lives in `@workspace/curriculum`.
 * Same pattern as curriculumG10ChemSem1: app code and the API server read the
 * identical dataset, so evaluations can never grade against a different
 * curriculum than the one the teacher saw.
 */
export * from '@workspace/curriculum/catalogs/g2Math';
