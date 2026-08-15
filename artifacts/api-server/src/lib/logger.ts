import pino from "pino";
import { recordError } from "./errorLog.ts";

const isProduction = process.env.NODE_ENV === "production";

// pino's numeric level for "error" — every call at this level or above
// (error, fatal) also lands in the in-memory recent-errors buffer.
const ERROR_LEVEL = 50;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  hooks: {
    logMethod(args, method, level) {
      if (level >= ERROR_LEVEL) {
        const [first, second] = args;
        const message =
          typeof second === "string" ? second : typeof first === "string" ? first : "error";
        recordError(message, typeof first === "object" ? first : undefined);
      }
      return method.apply(this, args);
    },
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
