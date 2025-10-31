/**
 * routes/redirect.routes.js
 * Short: Public redirect service with per-link + per-IP throttling and click logging.
 *
 * Changed Today:
 * - PRO blocks, named constants for cookie max-age and limiter settings.
 * - Dynamic queue import kept with safe inline fallback.
 * - Error page stays lightweight, branded, and cache-safe.
 */

import { Router } from "express";
import crypto from "crypto";
import Link from "../models/Link.js";
import Click from "../models/Click.js";
import { redirectLimiter, perLinkLimiter } from "../middlewares/rateLimit.js";
import { ipHash as hashIp, comparePassword } from "../utils/crypto.js";
import { parseUTM } from "../utils/parse.js";
import { getCountryFromHeaders } from "../utils/geo.js";
import { parseUA } from "../utils/ua.js";

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const PW_COOKIE_AGE_MS = 60 * 60 * 1000; // 1 hour

/* ================================================================== */
/* Optional queue (BullMQ) with graceful fallback                      */
/* ================================================================== */
let enqueueClick = async (payload) => {
  process.nextTick(async () => {
    try {
      await Click.create(payload);
      await Link.updateOne({ _id: payload.linkId }, { $inc: { clicksCount: 1 } });
    } catch {
      // swallow: keep redirect fast
    }
  });
};
try {
  const mod = await import("../queue/index.js").catch(async () => {
    // secondary fallback path if you keep another queue service wrapper
    return await import("../services/queue.js");
  });
  if (mod?.enqueueClick) enqueueClick = mod.enqueueClick;
} catch {
  // if dynamic import fails, inline fallback remains active
}

const r = Router();

/* ================================================================== */
/* Simple branded error page                                           */
/* ================================================================== */
function errorPage({ title, subtitle, code, brand = "Shortly" }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${code} • ${brand}</title>
<style>
  :root{--bg:#0b0b0c;--card:#141417;--border:#2a2a2e;--text:#e5e5e5;--muted:#a1a1aa;--brand:#10b981;}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font:14px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
  .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{width:min(520px,92vw);background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px}
  h1{margin:0 0 6px;font-size:20px} p{margin:0 0 12px;color:var(--muted)}
  .btn{display:inline-block;background:var(--brand);color:#042a1f;padding:10px 16px;border-radius:999px;font-weight:700;text-decoration:none}
</style></head>
<body>
  <main class="wrap"><section class="card">
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <a href="/" class="btn">Go home</a>
  </section></main>
</body></html>`;
}

/* ================================================================== */
/* Health endpoints                                                    */
/* ================================================================== */
r.get("/_health", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ ok: true, service: "shortly-redirect" });
});

r.get("/_health.png", (_req, res) => {
  const png = Buffer.from(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082",
    "hex"
  );
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.send(png);
});

/* ================================================================== */
/* Unlock page (placeholder)
   Keep your existing unlock page handler here if you have one.        */
/* ================================================================== */
// r.get("/r/:code/unlock", ...)

/* ================================================================== */
/* Redirect                                                            */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Resolve a short code → long URL with guardrails.
   Context: Enforces active/expiry/maxClicks and optional password.
   Edge cases: Per-link rate limits throttle abuse; queue logging async. */
/* ------------------------------------------------------------------ */
r.get("/:code", redirectLimiter, perLinkLimiter({ windowMs: 5000, max: 12 }), async (req, res) => {
  const code = String(req.params.code || "").trim();
  const link = await Link.findOne({ code }).lean();

  if (!link || !link.isActive) {
    res
      .status(404)
      .send(
        errorPage({
          title: "Link not found",
          subtitle: "This short link is invalid or has been disabled.",
          code: 404,
        })
      );
    return;
  }
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    res
      .status(410)
      .send(
        errorPage({
          title: "Link expired",
          subtitle: "The link has passed its expiry date.",
          code: 410,
        })
      );
    return;
  }
  if (link.maxClicks && link.clicksCount >= link.maxClicks) {
    res
      .status(429)
      .send(
        errorPage({
          title: "Max clicks reached",
          subtitle: "This link is no longer available.",
          code: 429,
        })
      );
    return;
  }

  // Optional password gate
  if (link.passwordHash) {
    const rawKey = `sl_pw_ok_${String(link._id)}`;
    const cookieKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, "");
    const okCookie = req.signedCookies?.[cookieKey] === "1";
    const pw = (req.query.pw || "").toString();
    const okPw = pw ? await comparePassword(pw, link.passwordHash) : false;
    const cameBackOk = req.query.ok === "1";

    if (!okCookie && !okPw) return res.redirect(302, `/r/${code}/unlock`);
    if (pw && !okPw) return res.redirect(302, `/r/${code}/unlock?e=1`);

    if (okPw && !okCookie && !cameBackOk) {
      res.cookie(cookieKey, "1", {
        httpOnly: true,
        signed: true,
        sameSite: "lax",
        maxAge: PW_COOKIE_AGE_MS,
        path: "/",
      });
      return res.redirect(302, `/r/${code}?ok=1`);
    }
  }

  // Log click (async) and redirect
  const referer = req.get("referer") || "direct";
  const tzOffset = parseInt(req.query.tzOffset || "0", 10) || 0;
  const utm = parseUTM(req.query);
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "0.0.0.0";
  const uaStr = req.get("user-agent") || "";
  const ipH = hashIp(ip);
  const country = getCountryFromHeaders(req);
  const { device, browser } = parseUA(uaStr);

  await enqueueClick({
    linkId: link._id,
    referer,
    tzOffset,
    utm,
    ipHash: ipH,
    ua: uaStr,
    country,
    device,
    browser,
  });

  res.redirect(302, link.longUrl);
});

export default r;
