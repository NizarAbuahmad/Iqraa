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
import { logger } from "../lib/logger";
import { isR2Configured, presignedGetUrl } from "../lib/r2";

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

  // `count` turns one lookup into a browsable set for the media-library
  // picker. Absent means 1, which is the deck builder's original call and
  // keeps its exact behaviour — including the download ping below.
  const requested = Number(req.query.count ?? 1);
  const count = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 10) : 1;

  try {
    const url = `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query)}`
      + `&per_page=${count}&orientation=landscape&content_filter=high`;
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    if (!response.ok) {
      res.json({ photo: null });
      return;
    }
    const data = (await response.json()) as UnsplashSearchResponse;
    const results = data.results ?? [];
    if (results.length === 0) {
      res.json({ photo: null });
      return;
    }

    // Unsplash requires the download endpoint to be hit when a photo is
    // actually *used*, not merely listed. Asking for one photo is the deck
    // builder about to put it on a slide, so that still pings here; a picker
    // asking for ten is browsing, and pings the one the teacher chooses
    // through POST /media/unsplash-used instead. Pinging all ten would report
    // nine uses that never happened.
    if (count === 1) pingDownload(results[0]!.links.download_location, accessKey);

    const photos = results.map(result => ({
      url: result.urls.regular,
      thumbUrl: result.urls.small,
      photographer: result.user.name,
      photographerUrl: `${result.user.links.html}?utm_source=iqraa&utm_medium=referral`,
      unsplashLink: `${result.links.html}?utm_source=iqraa&utm_medium=referral`,
      downloadLocation: result.links.download_location,
    }));

    // `photo` stays the first result so existing callers are untouched.
    res.json({ photo: photos[0], photos });
  } catch (err) {
    logger.error({ err }, "unsplash-photo lookup failed");
    res.json({ photo: null });
  }
});

/**
 * Report that a listed photo is now actually being used.
 *
 * The other half of the licence obligation described above: the picker lists
 * without pinging, so the ping has to happen when the teacher picks. Answers
 * 204 whatever happens — a failed attribution ping must never look like a
 * failed "add this picture to my lesson".
 */
mediaRouter.post("/media/unsplash-used", (req, res) => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const downloadLocation = String(req.body?.downloadLocation ?? "");
  // Only ever Unsplash's own endpoint — this takes a URL from a client and
  // fetches it, so without the host check it is an open request proxy.
  if (accessKey && /^https:\/\/api\.unsplash\.com\//.test(downloadLocation)) {
    pingDownload(downloadLocation, accessKey);
  }
  res.status(204).end();
});

interface YouTubeSearchResponse {
  items?: Array<{
    id: { videoId: string };
    snippet: { title: string; channelTitle: string };
  }>;
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
