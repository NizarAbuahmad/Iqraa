/**
 * Every piece of text in a stored AI artifact, in order, one per line — so the
 * admin reviewing a report (app/admin/artifact-reports.tsx) can read what was
 * served without a renderer per kind. Keys, ids and flags are skipped; only
 * strings and numbers that hold content are kept.
 */
const SKIP_KEYS = new Set(['id', 'type', 'kind', 'language', 'lang', 'icon', 'color', 'image', 'imageUrl', 'url', 'layout']);

export function artifactText(content: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key?: string) => {
    if (key && SKIP_KEYS.has(key)) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) out.push(s);
    } else if (typeof v === 'number' && key !== undefined && !/index|order|width|height/i.test(key)) {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  walk(content);
  return out;
}
