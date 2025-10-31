/**
 * utils/geo.js
 * Short: Lightweight helpers for deriving geo info from request headers.

 */

/**
 * Best-effort country from common CDN headers (Cloudflare/Vercel) or X-Geo-Country.
 * Falls back to null if not present.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getCountryFromHeaders(req) {
  return (
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-geo-country"] ||
    null
  )?.toString().toUpperCase() || null;
}
