import cors from "cors";
import "express-async-errors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./env";
import { logger } from "./logger";
import { isZodError, HttpError, getErrorMessage } from "./utils/http";
import apiRouter from "./routes/router";
import webhooksRouter from "./routes/webhooks";

// Hosts whose subdomains we always trust — avoids one-off env config
// pain and keeps Vercel preview deployments working.
const TRUSTED_HOST_SUFFIXES = [".vercel.app", ".netlify.app", ".onrender.com"];

function isOriginAllowed(origin: string): boolean {
  if (!env.CORS_ORIGIN) return true; // unconfigured → allow all (dev convenience)
  const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  if (allowed.includes("*")) return true;
  if (allowed.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (TRUSTED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  } catch {
    // ignore — invalid origin URL, treat as denied
  }
  return false;
}

export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (isOriginAllowed(origin)) return cb(null, true);
        logger.warn({ origin }, "CORS rejected request from origin");
        return cb(null, false);
      },
      credentials: false,
    }),
  );
  app.use(helmet());

  // Stripe webhook uses a raw parser and must mount before express.json().
  app.use("/api/v1/webhooks", webhooksRouter);

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", apiRouter);

  // 404
  app.use((_req, _res, next) => next(new HttpError(404, "Not Found")));

  // Error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (isZodError(err)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Validation failed",
          details: err.flatten(),
        });
      }

      if (err instanceof HttpError) {
        return res.status(err.status).json({
          error: err.status >= 500 ? "Internal Server Error" : "Error",
          message: err.message,
          details: err.details,
        });
      }

      logger.error({ err }, "Unhandled error");
      return res.status(500).json({
        error: "Internal Server Error",
        message: getErrorMessage(err),
      });
    },
  );

  return app;
}
