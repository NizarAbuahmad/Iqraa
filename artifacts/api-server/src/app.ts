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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Safety net for anything a route didn't catch itself (a sync throw before
// its try block, middleware errors, a promise rejection passed to next()).
// Every route today catches its own errors and responds directly, so this
// covers the residual gap rather than the common case — but it lands in the
// same recent-errors buffer as every logger.error() call (see lib/logger.ts),
// so anything caught here shows up at GET /api/healthz/errors too.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url }, "unhandled error");
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
