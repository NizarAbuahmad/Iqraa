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

if (html.includes('manifest.webmanifest')) {
  console.log('[pwa] already injected, nothing to do.');
  process.exit(0);
}

// The document is Arabic-first and right-to-left. Expo's template hardcodes
// lang="en", which tells a screen reader to pronounce Arabic as English.
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

const TAGS = `
    <link rel="manifest" href="/manifest.webmanifest" />
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
console.log('[pwa] manifest + install meta injected into dist/index.html');
