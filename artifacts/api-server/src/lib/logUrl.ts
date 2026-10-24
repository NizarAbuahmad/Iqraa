/**
 * A request URL that is safe to write to a log.
 *
 * The parent's approval link carries its token as a path segment (`/guardian-consent/:token`), and the token is a
 * bearer credential: whoever reads it can decide for the parent. So the segment is replaced before any URL reaches a
 * log line. `/guardian-consent/config` is a fixed word, not a token, and stays readable.
 */
export function redactedUrl(url: string | undefined): string | undefined {
  return url?.replace(/^((?:\/api)?\/guardian-consent\/)(?!config(?:[/?#]|$))[^/?#]+/, "$1:token");
}
