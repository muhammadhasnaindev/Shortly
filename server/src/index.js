/**
 * server/src/index.js
 * Short: API bootstrap (security, CORS, routes, error boundaries, queue, DB).
 
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createLimiter } from "./middlewares/rateLimit.js";

import authRoutes from "./routes/auth.routes.js";
import linkRoutes from "./routes/link.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import redirectRoutes from "./routes/redirect.routes.js";
import { notFound, errorHandler } from "./middlewares/error.js";
import { initQueue } from "./queue/index.js";

const app = express();
app.set("trust proxy", 1); // for x-forwarded-for, https proto behind proxies

/* ================================================================== */
/* Core middleware                                                     */
/* ================================================================== */
app.use(helmet());
app.use(morgan("dev"));

/* ================================================================== */
/* CORS allowlist (no "*" when credentials true)                       */
/* ================================================================== */
const allowlist =
  env.CLIENT_ORIGINS?.length ? env.CLIENT_ORIGINS : env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : [];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Postman/cURL
      if (allowlist.length === 0) return cb(null, true); // last resort (dev)
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(env.COOKIE_SECRET));

/* ================================================================== */
/* Rate limiting                                                       */
/* ================================================================== */
app.use(createLimiter);

/* ================================================================== */
/* Health                                                              */
/* ================================================================== */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/links", linkRoutes);
app.use("/api", analyticsRoutes);
app.use("/api/admin", adminRoutes);

/* ================================================================== */
/* Public redirect                                                     */
/* ================================================================== */
app.use("/r", redirectRoutes);

/* ================================================================== */
/* Errors                                                              */
/* ================================================================== */
app.use(notFound);
app.use(errorHandler);

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */
(async () => {
  await connectDB();
  try {
    await initQueue();
  } catch (e) {
    console.warn("Queue init failed:", e?.message || e);
  }
  app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
})();

/* ================================================================== */
/* Safety                                                              */
/* ================================================================== */
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
