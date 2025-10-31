/**
 * rateLimiters.js
 * Short: Express-rate-limit presets for general, redirect, and per-link traffic.
 
 */

import rateLimit from "express-rate-limit";

/* ------------------------------------------------------------------ */
/* Constants (avoid magic numbers)                                    */
/* ------------------------------------------------------------------ */
const ONE_MIN_MS = 60 * 1000;
const TEN_SEC_MS = 10 * 1000;

const DEFAULT_WINDOW_REQUESTS = 60;
const DEFAULT_REDIRECT_REQUESTS = 50;

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Generic per-IP throttle for typical API routes.
   Context: Protects against bursts while keeping UX responsive.
   Edge cases: Proxies still keyed by IP unless a custom key is added.
   Notes: Standard headers on; legacy headers off.                    */
/* ------------------------------------------------------------------ */
export const createLimiter = rateLimit({
  windowMs: ONE_MIN_MS,
  max: DEFAULT_WINDOW_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Tighter limiter for redirect endpoints.
   Context: Redirects can be abused by bots hammering links.
   Edge cases: Very short windows benefit analytics accuracy.
   Notes: Tune values based on real traffic.                          */
/* ------------------------------------------------------------------ */
export const redirectLimiter = rateLimit({
  windowMs: TEN_SEC_MS,
  max: DEFAULT_REDIRECT_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Throttle link hits using a compound key (code+IP).
   Context: Per-IP alone is weak where many codes exist.
   Edge cases: Uses first x-forwarded-for IP; falls back to socket IP.
   Notes: Same behavior as before; defaults remain conservative.      */
/* ------------------------------------------------------------------ */
export function perLinkLimiter({ windowMs = 5000, max = 10 } = {}) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
        req.socket.remoteAddress ||
        "0.0.0.0";
      const code = req.params?.code || "";
      return `${code}|${ip}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
