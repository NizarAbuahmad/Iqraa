/**
 * Stock-photo lookup for the deck builder — a free, appropriately licensed
 * image so a generated deck isn't all text. Proxied through here rather than
 * called from the mobile client directly so the Unsplash access key never
 * ships in the client bundle and the whole app shares one rate limit instead
 * of every device burning its own.
 */
import { Router } from "express";
import { logger } from "../lib/logger";

const mediaRouter = Router();

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

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

export default mediaRouter;
