/**
 * `/m/CODE` — a teacher's saved material opened from its share link, by anyone,
 * with or without an account (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md).
 *
 * The material screen itself, in its `code` mode (app/workspace/view.tsx):
 * read-only, the answers only for a teacher, who may save a copy. Public through
 * `PUBLIC_ROUTES` in services/routeGating.ts, so a visitor is not sent to log in.
 */
export { default } from '../workspace/view';
