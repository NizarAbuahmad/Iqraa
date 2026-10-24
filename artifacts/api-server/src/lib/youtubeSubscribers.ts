/**
 * Our own YouTube channel's subscriber count, for the admin dashboard's
 * «التنزيلات والمتابعون» row.
 *
 * Not `teacherChannel.ts`: that is a third party's channel we embed lessons
 * from. This one is looked up by handle (`forHandle`, 1 quota unit) so no
 * channel id has to be configured. YouTube rounds public counts above 1,000 to
 * three significant figures, which is fine for "are we growing".
 */
export const YOUTUBE_HANDLE = "IQRRA_ME";

/** The count out of a `channels.list?part=statistics` reply, or null when the channel hides it or is not found. */
export function parseSubscriberCount(body: unknown): number | null {
  const stats = (body as { items?: Array<{ statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }> } | null)
    ?.items?.[0]?.statistics;
  if (!stats || stats.hiddenSubscriberCount) return null;
  const n = Number(stats.subscriberCount);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** null on any failure — a missing number is a gap in a chart, never an error for the caller. */
export async function fetchSubscriberCount(apiKey: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  const r = await fetchFn(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${YOUTUBE_HANDLE}&key=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(4000) },
  );
  return r.ok ? parseSubscriberCount(await r.json()) : null;
}
