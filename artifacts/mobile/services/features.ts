/**
 * Feature switches for capabilities that are built but deliberately not offered.
 *
 * These are not dead code. Everything behind them works and is kept compiling
 * and tested, so turning one on is a one-line change rather than an excavation.
 */

/**
 * Teacher document upload in the Iqraa chat (PDF / Word / PowerPoint / images).
 *
 * Off since 2026-08-09. The reasoning is about cost, not capability: the whole
 * Jordanian curriculum is already in the app, so a teacher photographing a
 * textbook page pays to send the app content it already holds — and once real
 * generation is on, every one of those pages is tokens on every request that
 * references it.
 *
 * What upload is genuinely for is material the app does NOT have: last year's
 * exam, the department's own worksheet, a school lesson-plan template. Those
 * are planned as a proper library rather than an ad-hoc attachment, which is
 * why this is paused instead of deleted.
 *
 * Left intact behind the flag: `services/documents/*` (extraction, quick
 * actions), `DocumentAttachmentBar`, session-document state, and the
 * `attachments` field on chat messages. Flip this to `true` to restore.
 */
export const DOCUMENT_UPLOAD_ENABLED = false;
