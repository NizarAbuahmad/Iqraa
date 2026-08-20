/**
 * External-media lookups for the deck builder — a free, appropriately
 * licensed photo (Unsplash) and a real existing explainer video (YouTube
 * search, not generated) so a deck isn't all text. Both proxied through here
 * rather than called from the mobile client directly, so the access keys
 * never ship in the client bundle and the whole app shares one rate limit
 * instead of every device burning its own.
 */
import { Router } from "express";
import { logger } from "../lib/logger";

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

export default mediaRouter;
