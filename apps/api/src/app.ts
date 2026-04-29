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

export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));

  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = env.CORS_ORIGIN.split(",").map((o: string) => o.trim());
        if (!origin || allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      }
    })
  );
  app.use(helmet());

  // Stripe webhook uses a raw parser and must mount before express.json().
  app.use("/api/v1/webhooks", webhooksRouter);

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", apiRouter);

  // 404
  app.use((_req, _res, next) => next(new HttpError(404, "Not Found")));

  // Error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (isZodError(err)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Validation failed",
        details: err.flatten()
      });
    }

    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: err.status >= 500 ? "Internal Server Error" : "Error",
        message: err.message,
        details: err.details
      });
    }

    logger.error({ err }, "Unhandled error");
    return res.status(500).json({
      error: "Internal Server Error",
      message: getErrorMessage(err)
    });
  });

  return app;
}
