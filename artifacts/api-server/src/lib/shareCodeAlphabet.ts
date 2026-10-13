/**
 * No I, L, O, 0 or 1. A teacher writes a code on a whiteboard and thirty
 * students read it from the back of the room; a code that can be read two ways
 * is a code that produces "not found" and a raised hand.
 *
 * Its own file so lib/loginCode.ts can share it without importing
 * studentView.ts, which pulls in the whole question-type registry.
 */
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
