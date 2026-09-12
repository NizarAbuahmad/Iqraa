/**
 * Validation for a profile picture arriving as a `data:` URL, split out of
 * `routes/auth.ts` for the reason `lessonMediaUpload.ts` gives: that route
 * file imports `@workspace/db` at module scope, which throws without
 * `DATABASE_URL`, so nothing reachable from it is testable under
 * `node --test`. This part is pure.
 *
 * Deliberately NOT the same allowlist as lesson media. That one exists to
 * carry whatever a teacher photographs or attaches — audio, PDFs, HEIC
 * straight off an iPhone. An avatar is one small square that every client
 * has to render inside an `<Image>`, so the list here is only the formats a
 * browser and React Native both decode natively. HEIC in particular is
 * accepted for a lesson photo (the server only stores it) and refused here:
 * react-native-web cannot display it, so accepting it would store a picture
 * that renders as a broken box on the web build teachers actually use.
 */
import { parseDataUrl } from "./lessonMediaUpload.ts";

/**
 * ~1.5MB of base64, about 1.1MB decoded. The client downscales to
 * AVATAR_MAX_EDGE (512px) before sending, which lands well under this; the
 * ceiling is here for the paths that don't — a native build, where
 * `downscaleImage` is a no-op, handing over a phone-camera JPEG whole.
 * Far below the 12MB `express.json` limit on purpose: this endpoint writes to
 * R2 on every call and a profile picture has no business being megabytes.
 */
export const MAX_AVATAR_DATA_URL_LENGTH = 1_500_000;

/** The formats both a browser `<img>` and React Native's `Image` decode. */
export const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type AvatarRejection = {
  ok: false;
  /** HTTP status the route should answer with. */
  status: 400 | 413;
  code: "bad_data_url" | "file_too_large" | "unsupported_type";
  error: string;
};

export type AvatarUpload = {
  ok: true;
  mime: string;
  buffer: Buffer;
  /** Includes the leading dot, ready to append to a key. */
  extension: string;
};

/**
 * Decide whether this data URL may become someone's profile picture.
 *
 * Returns the decoded bytes on success, or the exact refusal to answer with —
 * status and code included, so the route has no second opinion about which
 * failure is a 400 and which is a 413.
 */
export function parseAvatarDataUrl(dataUrl: unknown): AvatarUpload | AvatarRejection {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "bad_data_url",
      error: "avatarDataUrl must be a data: URL",
    };
  }
  // Length first, before decoding: `parseDataUrl` allocates a Buffer the size
  // of the payload, so checking after it would mean materialising whatever
  // was sent in order to say it was too big.
  if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
    return {
      ok: false,
      status: 413,
      code: "file_too_large",
      error: "That picture is too large.",
    };
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      code: "bad_data_url",
      error: "avatarDataUrl must be a data: URL",
    };
  }

  const extension = AVATAR_EXTENSION_BY_MIME[parsed.mime];
  if (!extension) {
    return {
      ok: false,
      status: 400,
      code: "unsupported_type",
      error: `A profile picture must be a JPEG, PNG or WebP image (got ${parsed.mime})`,
    };
  }

  return { ok: true, mime: parsed.mime, buffer: parsed.buffer, extension };
}
