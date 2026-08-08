/**
 * Class Mode media helpers — graph and media slide construction.
 *
 * Phase-1 scope, deliberately: YouTube links and image URLs. Uploading
 * large video FILES needs server storage (phase 2); YouTube covers the
 * overwhelming majority of what science teachers actually project.
 */
import type { ActivitySlide } from './ai/AIService.ts';

/** Blank GeoGebra Graphing app — used when there is nothing to plot. */
export const GEOGEBRA_GRAPHING_URL = 'https://www.geogebra.org/graphing';

/**
 * GeoGebra Calculator Suite with commands preloaded.
 *
 * Verified against the live site: /calculator?command=f(x)=x^2 loads the
 * function (ggbApplet.getAllObjectNames() → ['f'], "f(x) = x²"). Multiple
 * commands are separated by ';'.
 *
 * Lives here rather than in geogebra.ts so it stays free of Expo native
 * imports and can be unit-tested.
 */
export function geogebraCommandUrl(commands: string[]): string {
  const joined = commands.map(c => c.trim()).filter(Boolean).join(';');
  if (!joined) return GEOGEBRA_GRAPHING_URL;
  return `https://www.geogebra.org/calculator?command=${encodeURIComponent(joined)}`;
}

/** Extract the YouTube video id from watch / share / embed / shorts links. */
export function youtubeIdFrom(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Privacy-friendly embed URL for a YouTube link, or null if not YouTube. */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeIdFrom(url);
  // youtube-nocookie keeps the classroom projection out of ad personalisation.
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

export function isLikelyImageUrl(url: string): boolean {
  return /^(https?:\/\/|data:image\/)/i.test(url.trim())
    && (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url.trim()) || /^data:image\//i.test(url.trim()));
}

/** Classify a pasted URL so the teacher doesn't have to pick a type. */
export function classifyMediaUrl(url: string): 'image' | 'video' | null {
  if (!url.trim()) return null;
  if (youtubeIdFrom(url)) return 'video';
  if (isLikelyImageUrl(url)) return 'image';
  return null;
}

export function buildGraphSlide(
  commands: string[],
  titleAr: string,
  isAr: boolean,
  slideNumber: number,
): ActivitySlide {
  return {
    slideNumber,
    type: 'graph',
    title: isAr ? '📈 الرسم البياني' : '📈 Graph',
    content: isAr
      ? `${titleAr}\n\nجرّب مع الطلاب: غيّر المعامل وشاهد أثره على المنحنى قبل أن تشرح السبب.`
      : `${titleAr}\n\nTry with the class: change a coefficient and watch the curve move before explaining why.`,
    graphCommands: commands,
    durationSeconds: 0,
  };
}

export function buildMediaSlide(
  kind: 'image' | 'video',
  url: string,
  caption: string,
  isAr: boolean,
  slideNumber: number,
): ActivitySlide {
  return {
    slideNumber,
    type: 'media',
    title: kind === 'video'
      ? (isAr ? '🎬 فيديو' : '🎬 Video')
      : (isAr ? '🖼️ صورة' : '🖼️ Image'),
    content: caption,
    mediaKind: kind,
    mediaUrl: url,
    mediaCaption: caption,
    durationSeconds: 0,
  };
}

/**
 * Pull plottable expressions out of lesson text so the graph slide opens on
 * something real. Conservative on purpose: only well-formed function
 * definitions (f(x)=…) and simple y=… equations, so we never feed GeoGebra
 * prose that would render an error in front of a class.
 */
export function extractGraphCommands(text: string, max = 3): string[] {
  if (!text) return [];
  // Generated math uses typographic characters GeoGebra won't parse:
  // superscripts and the true minus sign. Normalise before matching.
  text = text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-');
  const out: string[] = [];
  // The body is captured as math-safe characters ONLY, so the match stops at
  // the first non-math character (e.g. the Arabic word after the formula)
  // instead of swallowing prose and being rejected later.
  const re = /([fghy])\s*(\([a-z]\))?\s*=\s*([0-9a-z+\-*/^().√π]{1,40})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < max) {
    const name = m[1]!;
    const arg = m[2] ?? (name.toLowerCase() === 'y' ? '' : '(x)');
    const body = m[3]!.trim();
    // A constant is not a curve worth projecting — require a variable.
    if (!/[a-z]/i.test(body)) continue;
    const cmd = `${name}${arg}=${body}`;
    if (!out.includes(cmd)) out.push(cmd);
  }
  return out;
}
