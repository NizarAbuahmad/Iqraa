/**
 * External-media lookups for the deck builder — a free, appropriately
 * licensed photo (Unsplash) and a real existing explainer video (YouTube
 * search, not generated) so a deck isn't all text. Both proxied through here
 * rather than called from the mobile client directly, so the access keys
 * never ship in the client bundle and the whole app shares one rate limit
 * instead of every device burning its own.
 */
import { Router } from "express";
import { getExternalResource } from "@workspace/curriculum";
// Explicit .ts extensions: esbuild resolves without them, but `node --test`
// does not, and this module is now imported by a test (see CLAUDE.md).
import { logger } from "../lib/logger.ts";
import { isR2Configured, presignedGetUrl } from "../lib/r2.ts";

const mediaRouter = Router();

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

interface UnsplashSearchResponse {
  results?: Array<{
    urls: { regular: string; small: string };
    user: { name: string; links: { html: string } };
    links: { html: string; download_location: string };
  }>;
}

/**
 * Unsplash's API guidelines require pinging `download_location` whenever a
 * photo is actually shown to a user (not just returned from search). Best
 * effort — a failed ping must never fail the photo lookup itself.
 */
function pingDownload(downloadLocation: string, accessKey: string): void {
  const sep = downloadLocation.includes("?") ? "&" : "?";
  fetch(`${downloadLocation}${sep}client_id=${accessKey}`).catch(() => {});
}

mediaRouter.get("/media/unsplash-photo", async (req, res) => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    // Unconfigured is a normal deployment state, not an error — the deck
    // builder treats a null photo as "skip the image slide".
    res.json({ photo: null });
    return;
  }

  const query = String(req.query.query ?? "").trim().slice(0, 100);
  if (!query) {
    res.json({ photo: null });
    return;
  }

  try {
    const url = `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query)}`
      + `&per_page=1&orientation=landscape&content_filter=high`;
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    if (!response.ok) {
      // Logged, because the answer the client gets for a refused key, an
      // exhausted hourly allowance and a genuinely unphotogenic query is the
      // same `{ photo: null }` — the deck just skips the image slide either
      // way. Without a line here, running out of Unsplash quota is invisible:
      // it looks exactly like a search that found nothing, and the only other
      // place it would show up is a teacher wondering why decks stopped having
      // pictures. 429 is the rate limit; 401/403 is the key.
      logger.warn(
        { status: response.status, query, service: "unsplash" },
        response.status === 429
          ? "unsplash rate limit reached — decks will render without images until it resets"
          : "unsplash search failed",
      );
      res.json({ photo: null });
      return;
    }
    const data = (await response.json()) as UnsplashSearchResponse;
    const result = data.results?.[0];
    if (!result) {
      res.json({ photo: null });
      return;
    }

    pingDownload(result.links.download_location, accessKey);

    res.json({
      photo: {
        url: result.urls.regular,
        thumbUrl: result.urls.small,
        photographer: result.user.name,
        photographerUrl: `${result.user.links.html}?utm_source=iqraa&utm_medium=referral`,
        unsplashLink: `${result.links.html}?utm_source=iqraa&utm_medium=referral`,
      },
    });
  } catch (err) {
    logger.error({ err }, "unsplash-photo lookup failed");
    res.json({ photo: null });
  }
});

interface YouTubeSearchResponse {
  items?: Array<{
    id: { videoId: string };
    snippet: { title: string; channelTitle: string };
  }>;
}

/** The error envelope, whose `reason` separates a spent quota from a bad key. */
interface YouTubeErrorResponse {
  error?: { errors?: Array<{ reason?: string }> };
}

/**
 * The machine-readable reason out of a failed YouTube response, or undefined.
 *
 * Exported for its test. Everything here is a way of not throwing: a quota
 * failure arrives as JSON, but a proxy or an outage can answer 403 with HTML,
 * and this runs on the error path of a route whose whole contract is that a
 * missing video is never an error. Turning "no video today" into a 500 because
 * the explanation would not parse is the one outcome worse than not logging.
 */
export async function youtubeFailureReason(
  response: Pick<Response, "json">,
): Promise<string | undefined> {
  try {
    const body = (await response.json()) as YouTubeErrorResponse;
    const reason = body?.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : undefined;
  } catch {
    return undefined;
  }
}

mediaRouter.get("/media/youtube-video", async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // Unconfigured is a normal deployment state, not an error — the deck
    // builder treats a null video as "skip the video slide".
    res.json({ video: null, videos: [] });
    return;
  }

  const query = String(req.query.query ?? "").trim().slice(0, 150);
  if (!query) {
    res.json({ video: null, videos: [] });
    return;
  }
  const lang = req.query.lang === "ar" ? "ar" : "en";

  try {
    // Five, not one. A search costs 100 quota units whatever maxResults is,
    // so asking for alternatives here is free — and it is the difference
    // between a teacher who dislikes the pick having to leave the app and
    // having a second suggestion a tap away. Re-searching per rejection would
    // have cost 100 units each against a 10,000/day default.
    const url = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=5`
      + `&q=${encodeURIComponent(query)}&key=${apiKey}`
      // safeSearch=strict: this is a K-12 classroom app, not optional.
      // videoEmbeddable: a match the app can't actually play is useless.
      // videoDuration=medium: 4-20 min — long enough to be a real explainer,
      // short enough to not be a full recorded lecture or multi-hour stream.
      + `&safeSearch=strict&videoEmbeddable=true&videoDuration=medium&relevanceLanguage=${lang}`;
    const response = await fetch(url);
    if (!response.ok) {
      // The client cannot tell these apart — an exhausted quota, a rejected
      // key and a topic with no embeddable results all return
      // `{ video: null }`, and the deck simply skips the video slide. So this
      // is the only place the difference can be recorded.
      //
      // Worth naming the reason rather than just the status: YouTube answers
      // 403 both for `quotaExceeded` (wait until the daily reset at midnight
      // Pacific, or raise the quota) and for a key that has been disabled or
      // restricted (nothing resets; someone has to fix it). One search costs
      // 100 of a default 10,000 units a day, so the ceiling is roughly a
      // hundred decks a day across every teacher, and hitting it is a normal
      // Tuesday rather than an attack.
      const reason = await youtubeFailureReason(response);
      logger.warn(
        { status: response.status, reason, query, service: "youtube" },
        reason === "quotaExceeded"
          ? "youtube daily quota exhausted — decks will render without videos until it resets"
          : "youtube search failed",
      );
      res.json({ video: null, videos: [] });
      return;
    }
    const data = (await response.json()) as YouTubeSearchResponse;
    const videos = (data.items ?? [])
      .filter(item => item?.id?.videoId)
      .map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
    if (videos.length === 0) {
      res.json({ video: null, videos: [] });
      return;
    }

    // `video` stays exactly what it was — the first result — so nothing that
    // reads this endpoint today has to change. `videos` is additive.
    res.json({ video: videos[0], videos });
  } catch (err) {
    logger.error({ err }, "youtube-video lookup failed");
    res.json({ video: null, videos: [] });
  }
});

/**
 * Serve our own copy of a curated external resource.
 *
 * Only resources carrying an `ingest` block have one: those are the ones whose
 * licence granted redistribution, so they were copied into R2 by
 * `fetch-external.ts`. A resource without one is pointed at, never served —
 * `sourceUrl` is the only address it has, and that is the whole distinction
 * `embed-only` exists to record.
 *
 * **The manifest is the allowlist.** The client names a resource id, never an
 * R2 key, so this cannot be turned into a read-anything-in-the-bucket
 * endpoint by editing a URL — which it would be if it took the key directly.
 *
 * The attribution travels with the URL rather than being looked up separately
 * by whatever renders it. Every licence here requires the credit wherever the
 * asset appears, and a caller that has to make a second call to find out what
 * to print is a caller that will eventually skip it.
 */
mediaRouter.get("/media/external/:id", async (req, res) => {
  try {
    const resource = getExternalResource(req.params["id"] as string);
    if (!resource) {
      res.status(404).json({ error: "Unknown resource" });
      return;
    }
    if (!resource.ingest) {
      res.status(404).json({
        error: "This resource is not stored here — open it at its source",
        code: "not_ingested",
        sourceUrl: resource.sourceUrl,
      });
      return;
    }
    if (!isR2Configured()) {
      res.status(503).json({ error: "Media storage is not configured" });
      return;
    }
    res.json({
      url: await presignedGetUrl(resource.ingest.r2Key),
      kind: resource.kind,
      attribution: resource.attribution,
      sourceUrl: resource.sourceUrl,
      licenseUrl: resource.licenseUrl,
    });
  } catch (err) {
    logger.error({ err }, "external media lookup failed");
    res.status(500).json({ error: "Failed to load that resource" });
  }
});

export default mediaRouter;
