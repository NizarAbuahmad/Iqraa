import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
// Named, not default. `pino-http` exports both (`export default PinoHttp` and
// `export { PinoHttp as pinoHttp }`), and the default form is only callable
// under `esModuleInterop` or `moduleResolution: bundler` — which this repo
// sets, so `pnpm run typecheck` is happy, and which a bare `tsc` elsewhere does
// not, so it reports "this expression is not callable" plus two spurious
// implicit-any errors on the serializers below. The named import is callable
// under both, which is cheaper than owning that argument.
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Render sits in front of this app behind a proxy; without this, req.ip
// (used by the auth rate limiters) returns the proxy's address for every
// request instead of the real client, collapsing all callers into one bucket.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
/*
 * Response headers, before any route can answer.
 *
 * Two defaults are overridden, both because this is a cross-origin JSON API
 * rather than the website helmet's defaults assume:
 *
 * - `crossOriginResourcePolicy` ships as `same-origin`, which is the correct
 *   answer for a server that only feeds its own pages. This one is fetched
 *   from app.iqrra.com and answers a different origin by design.
 * - `contentSecurityPolicy` is off: every response here is JSON, so there is
 *   no document for a policy to govern, and helmet's default sends ~200 bytes
 *   of directives on every API call to say nothing. The CSP that matters is
 *   the web bundle's, and it lives in artifacts/mobile/public/_headers.
 *
 * HSTS, nosniff, referrer policy and frame options keep their defaults.
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

/*
 * Nothing this API returns is cacheable, and most of it is a teacher's roster
 * or a child's marks. Said once here rather than per route, because the one
 * route that forgets is the one that matters.
 */
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/**
 * Who may call this API from a browser.
 *
 * It used to be `cors()` — `Access-Control-Allow-Origin: *`, every origin on
 * the internet. Auth here is a bearer token rather than a cookie, so that was
 * never CSRF; what it was is a scripting surface on the routes that need no
 * token at all — `/take/:code` (a class list of minors), `/auth/join/:code`,
 * `/auth/login`, `/auth/register` — reachable from any page a teacher or
 * student happens to have open.
 *
 * A request with no `Origin` header is allowed: that is every native app
 * request, plus curl and the Cloud Run health check. `Origin` is set by
 * browsers, and it is browsers this list exists to constrain.
 *
 * CORS_ALLOWED_ORIGINS adds to the list at deploy time, comma-separated —
 * the escape hatch for a Cloudflare Pages branch preview, which gets a
 * generated hostname nobody can write down in advance. Adding one should not
 * need a code deploy of the API.
 */
const ALLOWED_ORIGINS = new Set([
  "https://app.iqrra.com",
  "https://iqrra.com",
  "https://www.iqrra.com",
  // The Pages project's own hostname, which app.iqrra.com is a CNAME to and
  // which stays reachable on its own.
  "https://iqraa-web.pages.dev",
  ...(process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean),
]);

/**
 * Any localhost port, off production only.
 *
 * A port list would have to name 8081 (MOBILE_PORT's default), whatever a
 * developer overrode it to, Expo's older 19006, and the Replit preview — and
 * the one it missed would surface as a bare CORS error in a browser console
 * with nothing pointing back here. A dev machine is not the thing this
 * allowlist is defending against; app.iqrra.com's users are.
 */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function originAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return process.env.NODE_ENV !== "production" && LOCAL_ORIGIN.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || originAllowed(origin)) {
        callback(null, true);
        return;
      }
      // `false`, not an Error: an Error here becomes a 500 through the handler
      // at the bottom of this file, which reads as "the API is broken" rather
      // than "that origin may not call it". Answering without the
      // Allow-Origin header is what refuses the caller, and it is the browser
      // that enforces it.
      logger.warn({ origin }, "cors: origin not allowed");
      callback(null, false);
    },
  }),
);
/**
 * 12MB, not the 100KB default.
 *
 * A teacher photographing a marked exam paper sends the image inline as a data
 * URL — there is no object storage in this app — and a phone photo is several
 * megabytes before base64 inflates it by a third. At the default limit the
 * body parser rejected it *before any route ran*, so the teacher got
 * "Internal server error" from the handler below with nothing to act on.
 *
 * The ceiling is still real: `scan-marks` refuses anything over 8MB itself,
 * with a message that says to retake the photo. This limit only has to be
 * high enough that the refusal comes from a place that can explain itself.
 */
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Safety net for anything a route didn't catch itself (a sync throw before
// its try block, middleware errors, a promise rejection passed to next()).
// Every route today catches its own errors and responds directly, so this
// covers the residual gap rather than the common case — but it lands in the
// same recent-errors buffer as every logger.error() call (see lib/logger.ts),
// so anything caught here shows up at GET /api/healthz/errors too.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }
  // A body over the limit is the caller's problem, not a server fault, and
  // answering 500 tells them nothing they can act on. Named explicitly because
  // it is now reachable by ordinary use: a teacher photographing a paper.
  if ((err as { type?: string })?.type === "entity.too.large") {
    logger.warn({ url: req.url }, "request body too large");
    res.status(413).json({
      error: "That upload is too large. Try again at a lower quality.",
      code: "payload_too_large",
    });
    return;
  }
  logger.error({ err, url: req.url }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
