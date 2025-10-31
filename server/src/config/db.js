/**
 * db.js
 * Short: Central MongoDB connection bootstrap with minimal, explicit options.
 */

import mongoose from "mongoose";
import { env } from "./env.js";

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Fail fast and connect with explicit, minimal options
   Context: Network and DNS issues are common; clear logs reduce MTTR.
   Edge cases: Missing/placeholder URIs; SRV DNS failures on Atlas.
   Notes: No behavior change beyond cleaner logs and early guard.       */
/* ------------------------------------------------------------------ */

const SERVER_SELECTION_TIMEOUT_MS = 8000;

mongoose.set("strictQuery", true);

/**
 * Connect to MongoDB using the configured MONGO_URI.
 *
 * @returns {Promise<void>}
 * @throws {Error} If no MONGO_URI is configured or connection fails.
 */
export async function connectDB() {
  if (!env?.MONGO_URI) {
    throw new Error("MongoDB connection aborted: MONGO_URI is not configured.");
  }

  try {
    const isSrv = env.MONGO_URI.startsWith("mongodb+srv://");

    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      // Keep options minimal; add only when truly required for your infra.
    });

    console.log("MongoDB connected");
  } catch (err) {
    const msg = String(err?.message || err || "");
    console.error("MongoDB connection error:", msg);

    /* -------------------------------------------------------------- */
    /* [PRO] Purpose: Provide actionable hint for common SRV failures
       Context: Atlas SRV records require correct host + URL-encoding.
       Edge cases: DNS (getaddrinfo) and querySrv resolution failures.
       Notes: This is a log hint only; no control flow changes.       */
    /* -------------------------------------------------------------- */
    if (msg.includes("getaddrinfo") || msg.includes("querySrv")) {
      console.error(
        "Hint: For Atlas SRV URIs, ensure the host looks like 'cluster0.xxxxx.mongodb.net' and the password is URL-encoded."
      );
    }

    process.exit(1);
  }
}
