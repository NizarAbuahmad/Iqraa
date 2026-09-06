/**
 * Verification gates — re-exported from `@workspace/math-verify`.
 *
 * They moved into a shared package because the server-side exam generator
 * needs the same decision when it checks a model-written answer key, and two
 * copies of a correctness control drift. This file stays so existing mobile
 * imports keep working unchanged; add gates to the package, not here.
 */
export * from '@workspace/math-verify';
