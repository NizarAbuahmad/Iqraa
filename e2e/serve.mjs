// Serves artifacts/mobile/dist the way Cloudflare Pages does (public/_redirects:
// `/* /index.html 200`): a real file if there is one, index.html for any other
// path, so a cold load of /take/ABC123 reaches the router instead of a 404.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../artifacts/mobile/dist", import.meta.url)));
const port = Number(process.env.WEB_PORT ?? 8098);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".map": "application/json",
};

if (!existsSync(join(root, "index.html"))) {
  console.error(`No web build at ${root}. Run: pnpm --filter @workspace/mobile run build:web`);
  process.exit(1);
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(root, path);
  // Never serve outside the build directory.
  if (file !== root && !file.startsWith(root + sep)) file = join(root, "index.html");
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on :${port}`));
