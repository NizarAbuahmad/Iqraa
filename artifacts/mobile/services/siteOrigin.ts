/**
 * Where the web app lives, for links handed out from a build that has no
 * `window.location` of its own (the Android app). A share link built from an
 * empty origin is a bare path that opens nothing when pasted into a chat.
 */
export const PROD_ORIGIN = 'https://app.iqrra.com';
