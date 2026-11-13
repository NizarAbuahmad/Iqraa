/**
 * The view onto the plane. The implementation moved to `lib/figure/src/viewport.ts`
 * (2026-11) so the drawn-figure code that the API and the app share can use it;
 * this file re-exports it unchanged for the grapher, the sketchpad and the tests.
 */
export * from '@workspace/figure/viewport';
