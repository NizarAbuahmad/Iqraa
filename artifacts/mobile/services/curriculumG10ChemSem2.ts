/**
 * Re-export shim for the Grade 10 Chemistry Semester 2 catalog.
 * Kept so app imports of `@/services/curriculumG10ChemSem2` keep working —
 * the data itself lives in `@workspace/curriculum`, shared with the API.
 */
export * from '@workspace/curriculum/catalogs/g10ChemSem2';
