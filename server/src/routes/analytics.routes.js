/**
 * routes/analytics.routes.js
 * Short: Authenticated analytics API (per-link and account-wide), saved views,
 * annotations, share tokens, and email digests.
 */

import { Router } from "express";
import mongoose from "mongoose";
import Click from "../models/Click.js";
import Link from "../models/Link.js";
import { requireAuth } from "../middlewares/auth.js";
import { env } from "../config/env.js";

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const TOP_REFERRERS_LIMIT = 5;
const TOP_REFERRERS_OVERVIEW_LIMIT = 7;
const TOP_COUNTRIES_LIMIT = 10;
const TOP_COUNTRIES_OVERVIEW_LIMIT = 12;
const RECENT_CLICKS_LIMIT = 200;
const TOP_LINKS_LIMIT = 10;
const TOP_COHORTS_LIMIT = 20;
const DEFAULT_ANNOTATION_COLOR = "#ef4444";

const MIN_PER_DAY = 1440;
const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/* ================================================================== */
/* Optional dynamic deps (mailer / JWT). Fallbacks keep routes alive.  */
/* ================================================================== */
let nodemailer = null;
try {
  const mod = await import("nodemailer");
  nodemailer = mod.default || mod;
} catch {
  // mailer not configured → routes will return informative messages
}

let jwt = null;
try {
  const mod = await import("jsonwebtoken");
  jwt = mod.default || mod;
} catch {
  // jwt not configured → share endpoints will 501
}

const r = Router();

/* ================================================================== */
/* Inline Models (scoped to this route module)                          */
/* ================================================================== */
const SavedView =
  mongoose.models.SavedView ||
  mongoose.model(
    "SavedView",
    new mongoose.Schema(
      {
        ownerId: { type: mongoose.Types.ObjectId, index: true, required: true },
        name: { type: String, required: true },
        range: { type: String, enum: ["24h", "7d", "30d"], default: "7d" },
        compare: { type: Boolean, default: false },
        filters: {
          country: String,
          device: String,
          browser: String,
          source: String,
          medium: String,
          campaign: String,
        },
        breakdown: { type: String, enum: ["none", "device", "browser", "country"], default: "none" },
      },
      { timestamps: true }
    )
  );

const Annotation =
  mongoose.models.Annotation ||
  mongoose.model(
    "Annotation",
    new mongoose.Schema(
      {
        ownerId: { type: mongoose.Types.ObjectId, index: true, required: true },
        scope: { type: String, default: "overview" },
        ts: { type: Date, required: true, index: true },
        label: { type: String, required: true },
        color: { type: String, default: DEFAULT_ANNOTATION_COLOR },
      },
      { timestamps: true }
    )
  );

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Normalize user-friendly ranges to time windows.
   Context: UI passes 24h/7d/30d; server needs concrete math + labels.
   Edge cases: Unknown strings default to 7d to keep UX stable.        */
/* ------------------------------------------------------------------ */
/**
 * @param {"24h"|"7d"|"30d"|string} range
 * @returns {{ type: "hours"|"days", hours?: number, days: number, label: string }}
 */
function parseRange(range) {
  const r = String(range || "7d").toLowerCase();
  if (r === "24h") return { type: "hours", hours: 24, days: 1, label: "24h" };
  if (r === "30d") return { type: "days", days: 30, label: "30d" };
  return { type: "days", days: 7, label: "7d" };
}

/**
 * Turn query params into Click collection filters.
 * @param {Record<string,unknown>} q
 */
function commonFiltersFromQuery(q) {
  const f = {};
  if (q.source) f["utm.source"] = String(q.source);
  if (q.medium) f["utm.medium"] = String(q.medium);
  if (q.campaign) f["utm.campaign"] = String(q.campaign);
  if (q.country) f["country"] = String(q.country).toUpperCase();
  if (q.device) f["device"] = String(q.device);
  if (q.browser) f["browser"] = String(q.browser);
  return f;
}

function dateFormatForRange(rng) {
  return rng.type === "hours" ? "%Y-%m-%d %H:00" : "%Y-%m-%d";
}

r.use(requireAuth);

/* ================================================================== */
/* Per-link analytics                                                  */
/* ================================================================== */
r.get("/links/:id/analytics", async (req, res) => {
  const rng = parseRange(req.query.range);
  const tzMin = parseInt(req.query.tz || "0", 10) || 0;

  const link = await Link.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
  if (!link) return res.status(404).json({ message: "Not found" });

  const since =
    rng.type === "hours"
      ? new Date(Date.now() - (rng.hours ?? 24) * MS_PER_HOUR)
      : new Date(Date.now() - rng.days * MS_PER_DAY);

  const match = { linkId: link._id, ts: { $gte: since }, ...commonFiltersFromQuery(req.query) };
  const fmt = dateFormatForRange(rng);

  const [byDay, topReferrers, byCountry, byDevice, byBrowser, recent, utmValues] = await Promise.all([
    Click.aggregate([
      { $match: match },
      { $addFields: { localTs: { $add: ["$ts", tzMin * MS_PER_MIN] } } },
      { $group: { _id: { day: { $dateToString: { date: "$localTs", format: fmt } } }, clicks: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]),
    Click.aggregate([{ $match: match }, { $group: { _id: "$referer", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: TOP_REFERRERS_LIMIT }]),
    Click.aggregate([{ $match: match }, { $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: TOP_COUNTRIES_LIMIT }]),
    Click.aggregate([{ $match: match }, { $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Click.aggregate([{ $match: match }, { $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Click.find(match).sort({ ts: -1 }).limit(RECENT_CLICKS_LIMIT).lean(),
    Click.aggregate([
      { $match: { linkId: link._id } },
      {
        $group: {
          _id: null,
          sources: { $addToSet: "$utm.source" },
          mediums: { $addToSet: "$utm.medium" },
          campaigns: { $addToSet: "$utm.campaign" },
        },
      },
    ]),
  ]);

  res.json({
    byDay: byDay.map((d) => ({ day: d._id.day, clicks: d.clicks })),
    referrers: topReferrers.map((r) => ({ ref: r._id || "direct", count: r.count })),
    countries: byCountry.filter((x) => x._id).map((x) => ({ country: x._id, count: x.count })),
    devices: byDevice.map((x) => ({ device: x._id || "other", count: x.count })),
    browsers: byBrowser.map((x) => ({ browser: x._id || "Unknown", count: x.count })),
    recent: recent.map((c) => ({
      ts: c.ts,
      referer: c.referer || "direct",
      ua: c.ua || "",
      tzOffset: c.tzOffset || 0,
      utm: c.utm || {},
      country: c.country || null,
      device: c.device || "other",
      browser: c.browser || "Unknown",
    })),
    utmOptions: {
      sources: (utmValues[0]?.sources || []).filter(Boolean).sort(),
      mediums: (utmValues[0]?.mediums || []).filter(Boolean).sort(),
      campaigns: (utmValues[0]?.campaigns || []).filter(Boolean).sort(),
    },
  });
});

/* ================================================================== */
/* Overview + breakdown                                                */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Build the overview payload used by dashboard + share.
   Context: Multi-aggregate fan-out with optional comparison window.
   Edge cases: No links; breakdown limited to top keys to keep payloads lean. */
/* ------------------------------------------------------------------ */
/**
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.ownerId
 * @param {"24h"|"7d"|"30d"|string} params.range
 * @param {boolean} params.compare
 * @param {number} params.tzMin
 * @param {Record<string, any>} params.filters
 * @param {"none"|"device"|"browser"|"country"} params.breakdown
 */
async function buildOverviewPayload({ ownerId, range, compare, tzMin, filters, breakdown }) {
  const rng = parseRange(range);
  const now = Date.now();
  const since = rng.type === "hours" ? new Date(now - (rng.hours ?? 24) * MS_PER_HOUR) : new Date(now - rng.days * MS_PER_DAY);
  const sincePrev = rng.type === "hours" ? new Date(since.getTime() - (rng.hours ?? 24) * MS_PER_HOUR) : new Date(since.getTime() - rng.days * MS_PER_DAY);
  const fmt = dateFormatForRange(rng);

  const links = await Link.find({ ownerId }).select("_id code domain").lean();
  const linkIds = links.map((x) => x._id);
  if (!linkIds.length) {
    return {
      byDay: [],
      referrers: [],
      countries: [],
      devices: [],
      browsers: [],
      topLinks: [],
      totals: { clicks: 0, links: 0 },
      byDayPrev: [],
      totalsPrev: { clicks: 0 },
      cohorts: [],
      utmOptions: { sources: [], mediums: [], campaigns: [] },
      recent: [],
      annotations: [],
      breakdownSeries: [],
      breakdownKeys: [],
    };
  }

  const linksById = Object.fromEntries(links.map((x) => [String(x._id), x]));
  const baseMatch = { linkId: { $in: linkIds } };
  const matchNow = { ...baseMatch, ts: { $gte: since }, ...filters };
  const matchPrev = { ...baseMatch, ts: { $gte: sincePrev, $lt: since }, ...filters };

  // Determine top breakdown keys to keep series compact
  let breakdownKeys = [];
  if (breakdown && breakdown !== "none") {
    const field = breakdown === "device" ? "$device" : breakdown === "browser" ? "$browser" : "$country";
    const agg = await Click.aggregate([{ $match: matchNow }, { $group: { _id: field, c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 6 }]);
    breakdownKeys = agg.map((a) => a._id || (breakdown === "country" ? null : "other")).filter(Boolean);
  }

  const [
    byDay,
    topReferrers,
    byCountry,
    byDevice,
    byBrowser,
    totalsAgg,
    topLinksAgg,
    cohortsAgg,
    byDayPrev,
    totalsPrevAgg,
    utmOptionsAgg,
    recentRaw,
    annotations,
    breakdownAgg,
  ] = await Promise.all([
    Click.aggregate([
      { $match: matchNow },
      { $addFields: { localTs: { $add: ["$ts", tzMin * MS_PER_MIN] } } },
      { $group: { _id: { day: { $dateToString: { date: "$localTs", format: fmt } } }, clicks: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: "$referer", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: TOP_REFERRERS_OVERVIEW_LIMIT }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: TOP_COUNTRIES_OVERVIEW_LIMIT }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: null, clicks: { $sum: 1 } } }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: "$linkId", clicks: { $sum: 1 } } }, { $sort: { clicks: -1 } }, { $limit: TOP_LINKS_LIMIT }]),
    Click.aggregate([{ $match: matchNow }, { $group: { _id: { campaign: "$utm.campaign" }, clicks: { $sum: 1 } } }, { $sort: { clicks: -1 } }, { $limit: TOP_COHORTS_LIMIT }]),
    Click.aggregate([
      { $match: compare ? matchPrev : { _id: null, ts: new Date(0) } },
      { $addFields: { localTs: { $add: ["$ts", tzMin * MS_PER_MIN] } } },
      { $group: { _id: { day: { $dateToString: { date: "$localTs", format: fmt } } }, clicks: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } },
    ]),
    Click.aggregate([{ $match: compare ? matchPrev : { _id: null, ts: new Date(0) } }, { $group: { _id: null, clicks: { $sum: 1 } } }]),
    Click.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          sources: { $addToSet: "$utm.source" },
          mediums: { $addToSet: "$utm.medium" },
          campaigns: { $addToSet: "$utm.campaign" },
        },
      },
    ]),
    Click.find(matchNow).sort({ ts: -1 }).limit(RECENT_CLICKS_LIMIT).lean(),
    Annotation.find({ ownerId, ts: { $gte: since } }).sort({ ts: 1 }).lean(),
    breakdown && breakdown !== "none"
      ? Click.aggregate([
          { $match: matchNow },
          { $addFields: { localTs: { $add: ["$ts", tzMin * MS_PER_MIN] } } },
          {
            $group: {
              _id: {
                day: { $dateToString: { date: "$localTs", format: fmt } },
                key: breakdown === "device" ? "$device" : breakdown === "browser" ? "$browser" : "$country",
              },
              clicks: { $sum: 1 },
            },
          },
          { $sort: { "_id.day": 1 } },
        ])
      : [],
  ]);

  const topLinks = topLinksAgg.map((t) => {
    const link = linksById[String(t._id)];
    const origin = link?.domain ? `https://${link.domain}` : null;
    return {
      _id: String(t._id),
      code: link?.code,
      domain: link?.domain || "",
      shortUrl: origin ? `${origin}/r/${link?.code}` : null,
      clicks: t.clicks,
    };
  });

  let breakdownSeries = [];
  if (breakdown && breakdown !== "none") {
    const map = new Map();
    for (const row of breakdownAgg) {
      const day = row._id.day;
      const key = row._id.key || (breakdown === "country" ? null : "other");
      if (!key) continue;
      if (breakdownKeys.length && !breakdownKeys.includes(key)) continue;
      const target = map.get(day) || { day };
      target[key] = (target[key] || 0) + row.clicks;
      map.set(day, target);
    }
    breakdownSeries = Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }

  return {
    byDay: byDay.map((d) => ({ day: d._id.day, clicks: d.clicks })),
    referrers: topReferrers.map((r) => ({ ref: r._id || "direct", count: r.count })),
    countries: byCountry.filter((x) => x._id).map((x) => ({ country: x._id, count: x.count })),
    devices: byDevice.map((x) => ({ device: x._id || "other", count: x.count })),
    browsers: byBrowser.map((x) => ({ browser: x._id || "Unknown", count: x.count })),
    topLinks,
    totals: { clicks: totalsAgg[0]?.clicks || 0, links: links.length },
    byDayPrev: byDayPrev.map((d) => ({ day: d._id.day, clicks: d.clicks })),
    totalsPrev: { clicks: totalsPrevAgg[0]?.clicks || 0 },
    cohorts: cohortsAgg.map((c) => ({ campaign: c._id.campaign || "(none)", clicks: c.clicks })),
    utmOptions: {
      sources: (utmOptionsAgg[0]?.sources || []).filter(Boolean).sort(),
      mediums: (utmOptionsAgg[0]?.mediums || []).filter(Boolean).sort(),
      campaigns: (utmOptionsAgg[0]?.campaigns || []).filter(Boolean).sort(),
    },
    recent: recentRaw.map((c) => ({
      ts: c.ts,
      linkId: String(c.linkId),
      linkCode: linksById[String(c.linkId)]?.code || "",
      linkDomain: linksById[String(c.linkId)]?.domain || "",
      referer: c.referer || "direct",
      ua: c.ua || "",
      tzOffset: c.tzOffset || 0,
      utm_source: c.utm?.source || "",
      utm_medium: c.utm?.medium || "",
      utm_campaign: c.utm?.campaign || "",
      country: c.country || "",
      device: c.device || "other",
      browser: c.browser || "Unknown",
      ipHash: c.ipHash || "",
    })),
    annotations: annotations.map((a) => ({ _id: String(a._id), ts: a.ts, label: a.label, color: a.color })),
    breakdownSeries,
    breakdownKeys,
  };
}

/* ================================================================== */
/* Overview endpoints                                                  */
/* ================================================================== */
r.get("/analytics/overview", async (req, res) => {
  const range = String(req.query.range || "7d");
  const tzMin = parseInt(req.query.tz || "0", 10) || 0;
  const compare = String(req.query.compare || "0") === "1";
  const breakdown = String(req.query.breakdown || "none");
  const filters = commonFiltersFromQuery(req.query);

  const payload = await buildOverviewPayload({
    ownerId: req.user._id,
    range,
    compare,
    tzMin,
    filters,
    breakdown,
  });

  res.json(payload);
});

/* ================================================================== */
/* Saved Views                                                         */
/* ================================================================== */
r.get("/analytics/views", async (req, res) => {
  const views = await SavedView.find({ ownerId: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json(
    views.map((v) => ({
      _id: String(v._id),
      name: v.name,
      range: v.range,
      compare: v.compare,
      filters: v.filters || {},
      breakdown: v.breakdown || "none",
      updatedAt: v.updatedAt,
    }))
  );
});

r.post("/analytics/views", async (req, res) => {
  const { name, range = "7d", compare = false, filters = {}, breakdown = "none" } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ message: "Name required" });

  const v = await SavedView.create({
    ownerId: req.user._id,
    name: String(name).trim(),
    range,
    compare: !!compare,
    filters: filters || {},
    breakdown,
  });

  res.json({ ok: true, id: String(v._id) });
});

r.delete("/analytics/views/:id", async (req, res) => {
  await SavedView.deleteOne({ _id: req.params.id, ownerId: req.user._id });
  res.json({ ok: true });
});

/* ================================================================== */
/* Annotations                                                         */
/* ================================================================== */
r.get("/analytics/annotations", async (req, res) => {
  const rng = parseRange(req.query.range);
  const since = rng.type === "hours" ? new Date(Date.now() - (rng.hours ?? 24) * MS_PER_HOUR) : new Date(Date.now() - rng.days * MS_PER_DAY);
  const list = await Annotation.find({ ownerId: req.user._id, ts: { $gte: since } }).sort({ ts: 1 }).lean();
  res.json(list.map((a) => ({ _id: String(a._id), ts: a.ts, label: a.label, color: a.color })));
});

r.post("/analytics/annotations", async (req, res) => {
  const { ts, label, color } = req.body || {};
  if (!ts || !label) return res.status(400).json({ message: "ts and label required" });

  const a = await Annotation.create({
    ownerId: req.user._id,
    ts: new Date(ts),
    label: String(label),
    color: color || DEFAULT_ANNOTATION_COLOR,
  });

  res.json({ ok: true, id: String(a._id) });
});

r.delete("/analytics/annotations/:id", async (req, res) => {
  await Annotation.deleteOne({ _id: req.params.id, ownerId: req.user._id });
  res.json({ ok: true });
});

/* ================================================================== */
/* Share URLs                                                          */
/* ================================================================== */
r.post("/analytics/share/create", async (req, res) => {
  if (!jwt || !env.JWT_SECRET) {
    return res.status(501).json({ message: "JWT not configured on server" });
  }

  const { range = "7d", compare = false, filters = {}, breakdown = "none", expiresInDays = 14 } = req.body || {};
  const exp = Math.floor(Date.now() / 1000) + Math.max(1, Number(expiresInDays)) * (MIN_PER_DAY * 60); // days → seconds

  const token = jwt.sign(
    { sub: String(req.user._id), scope: "analytics:share", range, compare, filters, breakdown, exp },
    env.JWT_SECRET
  );

  const base = env.BASE_PUBLIC_URL || env.APP_ORIGIN || "";
  const url = `${base}/analytics?share=${encodeURIComponent(token)}`;

  res.json({ ok: true, token, url, expiresAt: new Date(exp * 1000).toISOString() });
});

r.get("/analytics/share/:token/overview", async (req, res) => {
  if (!jwt || !env.JWT_SECRET) {
    return res.status(501).json({ message: "JWT not configured on server" });
  }
  try {
    const decoded = jwt.verify(req.params.token, env.JWT_SECRET);
    if (decoded.scope !== "analytics:share") throw new Error("Bad scope");

    const tzMin = parseInt(req.query.tz || "0", 10) || 0;
    const range = req.query.range ? String(req.query.range) : decoded.range;
    const breakdown = req.query.breakdown ? String(req.query.breakdown) : decoded.breakdown;
    const compare = String(req.query.compare || (decoded.compare ? "1" : "0")) === "1";

    const filters = {};
    if (decoded.filters?.["utm.source"]) filters["utm.source"] = decoded.filters["utm.source"];
    if (decoded.filters?.["utm.medium"]) filters["utm.medium"] = decoded.filters["utm.medium"];
    if (decoded.filters?.["utm.campaign"]) filters["utm.campaign"] = decoded.filters["utm.campaign"];
    if (decoded.filters?.country) filters["country"] = decoded.filters.country;
    if (decoded.filters?.device) filters["device"] = decoded.filters.device;
    if (decoded.filters?.browser) filters["browser"] = decoded.filters.browser;

    const payload = await buildOverviewPayload({
      ownerId: new mongoose.Types.ObjectId(decoded.sub),
      range,
      compare,
      tzMin,
      filters,
      breakdown,
    });

    res.json({ ...payload, readOnly: true });
  } catch {
    res.status(400).json({ message: "Invalid or expired share token" });
  }
});

/* ================================================================== */
/* Email Digest                                                        */
/* ================================================================== */
r.post("/analytics/digest/send", async (req, res) => {
  try {
    const period = String(req.query.period || "7d");
    const tzMin = parseInt(req.query.tz || "0", 10) || 0;

    const data = await buildOverviewPayload({
      ownerId: req.user._id,
      range: period,
      compare: false,
      tzMin,
      filters: {},
      breakdown: "none",
    });

    // If nodemailer not configured, still succeed but explain
    if (!nodemailer || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      return res.status(200).json({ ok: true, message: "Digest requested (email not sent — mailer not configured)." });
    }

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: false,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });

    const toEmail = req.user.email;
    const total = data?.totals?.clicks || 0;
    const topLinks = (data?.topLinks || [])
      .slice(0, 5)
      .map((t) => `• ${t.shortUrl || t.code} — ${t.clicks} clicks`)
      .join("\n") || "—";

    await transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: toEmail,
      subject: `Your ${period.toUpperCase()} analytics digest`,
      text:
`Hi ${req.user.name || ""},

Total clicks: ${total}
Top links:
${topLinks}

Open dashboard: ${(env.BASE_PUBLIC_URL || env.APP_ORIGIN || "") + "/analytics"}`,
    });

    res.json({ ok: true, message: "Digest email sent." });
  } catch (e) {
    // Keep message generic; log server-side if needed
    res.status(500).json({ message: "Failed to send digest." });
  }
});

/* ================================================================== */
/* Feature Flags                                                       */
/* ================================================================== */
r.get("/analytics/config", (_req, res) => {
  // Only expose booleans required by client UI. No secrets.
  const shareConfigured = !!(jwt && env.JWT_SECRET);
  const mailConfigured = !!(nodemailer && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

  res.json({
    mail: mailConfigured,
    share: shareConfigured,
  });
});

export default r;
