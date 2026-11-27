/**
 * The optional "what is wrong" text on «بلّغ عن مشكلة». Pure, so it can run
 * under the bare `node --test` runner (no react-native import).
 *
 * `REPORT_REASON_MAX` mirrors `MAX_REPORT_REASON` in the API's
 * `lib/reportReason.ts`; the server cuts again regardless.
 */
export const REPORT_REASON_MAX = 500;

/** JSON body for the report request, or `undefined` when there is no reason to send. */
export function reportRequestBody(reason?: string): string | undefined {
  const text = (reason ?? '').trim().slice(0, REPORT_REASON_MAX);
  return text ? JSON.stringify({ reason: text }) : undefined;
}
