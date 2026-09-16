/**
 * Makes the web export installable.
 *
 * A teacher who opens Iqraa on a classroom projector gets an address bar, tabs
 * and a bookmarks strip across the top of the lesson. Installed to the home
 * screen it opens fullscreen, and the first thing the class sees is the lesson.
 * That difference is a manifest link and a handful of meta tags.
 *
 * Why a post-export step rather than `app/+html.tsx`: that file is only honoured
 * when `web.output` is `"static"`. This app exports as a single-page bundle, so
 * Expo builds `index.html` from its own template and an `+html.tsx` sitting in
 * the app directory is silently ignored — it typechecks, it looks right in the
 * diff, and none of it reaches the browser. Switching the whole app to static
 * rendering to gain a `<link>` would be a far larger change than the problem.
 *
 * Idempotent: running it twice leaves the same file.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(projectRoot, 'dist', 'index.html');

if (!existsSync(indexPath)) {
  console.error(`[pwa] ${indexPath} not found — run \`expo export --platform web\` first.`);
  process.exit(1);
}

let html = readFileSync(indexPath, 'utf8');

// One marker for the whole block — every tag above goes in together or not
// at all, so the manifest link standing in for all of them is safe.
if (html.includes('manifest.webmanifest')) {
  console.log('[pwa] already injected, nothing to do.');
  process.exit(0);
}

// The document is Arabic-first and right-to-left. Expo's template hardcodes
// lang="en", which tells a screen reader to pronounce Arabic as English.
//
// Note the `dir="rtl"` here does NOT survive to the running app:
// `LanguageContext.applyRTL` sets `dir="ltr"` at boot, because the app lays out
// RTL per component and a document-level `dir` double-flips those ~190 sites
// (see the web-RTL entry in STATUS.md). This line and that one disagree on
// purpose-by-accident — they were written months apart — and the runtime wins.
// Changing to document-level RTL means changing both, plus the flips.
html = html.replace(/<html lang="en">/, '<html lang="ar" dir="rtl">');

// viewport-fit=cover so the safe-area insets the app already respects have
// something to report once it runs fullscreen on a notched phone.
html = html.replace(
  /<meta name="viewport" content="([^"]*)"\s*\/>/,
  (_m, content) =>
    `<meta name="viewport" content="${content.includes('viewport-fit') ? content : `${content}, viewport-fit=cover`}" />`,
);

// app.json's themeColor paints the status bar brand navy, which sits directly
// above the app's white chat header and reads as a seam. Match the header
// instead, per scheme.
html = html.replace(/\s*<meta name="theme-color" content="[^"]*">/g, '');

// Which commit this bundle was built from, readable with view-source.
//
// Web auto-deploys on every merge; the API is deployed by hand and the app
// ships on its own cadence. Comparing them used to mean grepping the served
// bundle hash. A local `build:web` has no such variable, so 'dev' marks
// "not a deployed build" rather than pretending to a commit.
//
// BUILD_COMMIT first, host-neutral, because the build moved off Render to
// GitHub Actions on 2026-09-13 and RENDER_GIT_COMMIT does not exist there.
// The failure it prevents is silent: every deployed bundle would have said
// `dev`, which reads as "someone deployed a local build" and destroys the one
// marker that answers "is this change live?" — the exact question that went
// unanswered for a day when Render stopped deploying. RENDER_GIT_COMMIT is
// kept as a fallback so a Render build (or a rollback to one) still stamps
// correctly.
const buildCommit = process.env.BUILD_COMMIT ?? process.env.RENDER_GIT_COMMIT ?? 'dev';

// The share card. app.iqrra.com is the link in every button on the marketing
// site, so it is the address teachers actually paste into a WhatsApp group —
// and without these it arrives as a bare URL with the domain for a title.
//
// Absolute URLs, not paths: a crawler resolves og:image against the document,
// and the one crawler that matters here fetches the image from a different
// host than the one that rendered the page.
//
// og.jpg is the marketing site's card, copied into public/ rather than linked
// across to www.iqrra.com — one origin, so a change of hosting there cannot
// silently blank the app's preview.
//
// The canonical is deliberately the bare origin on every route: _redirects
// serves this same index.html for /workspace, /settings and the rest, so
// without it Google sees one page under a hundred URLs, twice over
// (app.iqrra.com and iqraa-web-buq.pages.dev).
const ORIGIN = 'https://app.iqrra.com';
const TITLE = 'اقرأ — حضّر حصّتك بالعربي، وفق المنهاج الأردني';
const DESC =
  'مساعد عربي يبني خطة الدرس وورقة العمل والاختبار القصير، مربوطة بأهداف منهاج الوزارة وجاهزة للطباعة خلال دقائق.';

const TAGS = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="description" content="${DESC}" />
    <link rel="canonical" href="${ORIGIN}/" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${ORIGIN}/" />
    <meta property="og:site_name" content="اقرأ" />
    <meta property="og:locale" content="ar_JO" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESC}" />
    <meta property="og:image" content="${ORIGIN}/og.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${TITLE}." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="build-commit" content="${buildCommit}" />
    <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0D2247" media="(prefers-color-scheme: dark)" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="اقرأ" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <style id="iqraa-preboot">
      /* Painted before the JS bundle boots, so the first frame is the app's own
         background rather than a white flash on the way to a navy screen. */
      body { background-color: #F5F7FA; }
      @media (prefers-color-scheme: dark) { body { background-color: #081B3A; } }
    </style>
`;

if (!html.includes('</head>')) {
  console.error('[pwa] no </head> in the exported index.html — template changed?');
  process.exit(1);
}
html = html.replace('</head>', `${TAGS}  </head>`);

writeFileSync(indexPath, html, 'utf8');
console.log('[pwa] manifest + install meta + share card injected into dist/index.html');
