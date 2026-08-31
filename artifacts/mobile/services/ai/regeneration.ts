/**
 * What the screen tells the server not to repeat when a teacher regenerates.
 *
 * "Regenerate" used to re-send a byte-identical request, and the model
 * answered it with the same questions reworded — which is exactly the thing
 * the teacher pressed the button to get away from. The server can steer away
 * from a previous artifact, but only if it is told what the previous artifact
 * was, and the screen is the only party that knows what is on screen.
 *
 * Two things go back: `avoid` (the stems, so a fresh generation can be steered
 * off them) and `excludeVariantIds` (the pool variant currently displayed, so a
 * shared one is never handed back). The second is the cheap path — it costs no
 * model call at all — and it works only because the server echoes `variantId`
 * on every response.
 *
 * Kept deliberately dumb about artifact shapes: it walks for a fixed set of
 * key names rather than knowing what a quiz or a worksheet looks like. Six
 * generators with six shapes means a per-shape extractor is one more thing to
 * update, and it would fail by silently finding nothing to avoid — which reads
 * exactly like a successful regeneration.
 */

/** Keys whose string values say what an artifact *asks*, rather than how it is
 *  dressed. Mirrors SIGNATURE_KEYS in the API's `lib/variation.ts`; the two
 *  lists only need to overlap, not match — the server normalises and compares
 *  its own extraction against this one. */
const SIGNATURE_KEYS = new Set(['title', 'text', 'question', 'objective', 'description']);

const MAX_CHARS = 120;
const MAX_LINES = 24;
/** Below this a string is a section label («الأسئلة», "Answers") that every
 *  artifact of a kind shares. Sending them would ask the model to avoid its own
 *  output format. */
const MIN_CHARS = 12;

export function avoidSignatures(result: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, key: string | null, depth: number): void => {
    if (out.length >= MAX_LINES || depth > 8) return;
    if (typeof node === 'string') {
      if (!key || !SIGNATURE_KEYS.has(key)) return;
      const line = node.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
      if (line.length < MIN_CHARS || seen.has(line)) return;
      seen.add(line);
      out.push(line);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key, depth + 1);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, k, depth + 1);
      }
    }
  };

  walk(result, null, 0);
  return out;
}

/**
 * The regeneration fields to merge into a generation request.
 *
 * Returns `{}` for a first generation, so the request that a screen sends on
 * the common path is byte-for-byte what it sent before this existed — and the
 * server's neutral prompt, the one the generators were tuned against, is what
 * runs.
 */
export function regenerationFields(
  regenerate: boolean,
  current: unknown,
): { regenerate?: true; avoid?: string[]; excludeVariantIds?: string[] } {
  if (!regenerate || !current) return {};
  const variantId = (current as { variantId?: unknown }).variantId;
  const avoid = avoidSignatures(current);
  return {
    regenerate: true,
    ...(avoid.length ? { avoid } : {}),
    ...(typeof variantId === 'string' && variantId ? { excludeVariantIds: [variantId] } : {}),
  };
}
