import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(cors());
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
