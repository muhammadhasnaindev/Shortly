/**
 * routes/links.routes.js
 * Short: Authenticated CRUD for short links + listing + QR generation.
 */

import { Router } from "express";
import QRCode from "qrcode";
import Link from "../models/Link.js";
import Click from "../models/Click.js";
import { requireAuth } from "../middlewares/auth.js";
import { createLinkSchema, updateLinkSchema, isSafeUrl } from "../utils/validators.js";
import { genCode } from "../utils/code.js";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/crypto.js";
import { fetchPageMeta } from "../utils/meta.js";

const r = Router();
r.use(requireAuth);

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const LIST_SIZE_DEFAULT = 10;
const LIST_SIZE_MIN = 1;
const LIST_SIZE_MAX = 50;
const QR_SIZE_DEFAULT = 512;
const QR_SIZE_MAX = 2048;

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Produce canonical short URL for a link.
   Context: Users may use custom domain; else fall back to BASE_PUBLIC_URL.
   Edge cases: Domain stored without protocol; always prefix https://.     */
/* ------------------------------------------------------------------ */
function buildShortUrl(doc) {
  const origin = doc.domain ? `https://${doc.domain}` : env.BASE_PUBLIC_URL;
  return `${origin}/r/${doc.code}`;
}

/* ================================================================== */
/* Create                                                              */
/* ================================================================== */
r.post("/", async (req, res) => {
  const { value, error } = createLinkSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });
  if (!isSafeUrl(value.longUrl)) return res.status(400).json({ message: "Unsafe URL" });

  // ensure unique code (auto-generate on empty)
  let code = (value.code || "").trim();
  if (!code) {
    do {
      code = genCode();
    } while (await Link.findOne({ code }));
  } else {
    const exists = await Link.findOne({ code });
    if (exists) return res.status(409).json({ message: "Code already taken" });
  }

  const meta = await fetchPageMeta(value.longUrl).catch(() => ({}));

  const doc = await Link.create({
    ownerId: req.user._id,
    code,
    longUrl: value.longUrl,
    domain: (value.domain || "").trim().toLowerCase(),
    passwordHash: value.password ? hashPassword(value.password) : null,
    maxClicks: value.maxClicks || 0,
    meta: { ...meta, notes: value.notes || "" },
    expiresAt: value.expiresAt || null,
  });

  res.json({ ...doc.toObject(), shortUrl: buildShortUrl(doc) });
});

/* ================================================================== */
/* List                                                                */
/* ================================================================== */
r.get("/", async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const size = Math.min(
    Math.max(parseInt(req.query.size, 10) || LIST_SIZE_DEFAULT, LIST_SIZE_MIN),
    LIST_SIZE_MAX
  );
  const q = String(req.query.search || "").trim();

  const filter = { ownerId: req.user._id };
  if (q) {
    filter.$or = [
      { code: { $regex: q, $options: "i" } },
      { longUrl: { $regex: q, $options: "i" } },
      { "meta.notes": { $regex: q, $options: "i" } },
      { domain: { $regex: q, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Link.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
    Link.countDocuments(filter),
  ]);

  res.json({
    items: items.map((it) => ({ ...it, shortUrl: buildShortUrl(it) })),
    page,
    size,
    total,
  });
});

/* ================================================================== */
/* Read                                                                */
/* ================================================================== */
r.get("/:id", async (req, res) => {
  const doc = await Link.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json({ ...doc, shortUrl: buildShortUrl(doc) });
});

/* ================================================================== */
/* Update                                                              */
/* ================================================================== */
r.patch("/:id", async (req, res) => {
  const { value, error } = updateLinkSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });
  if (value.longUrl && !isSafeUrl(value.longUrl)) {
    return res.status(400).json({ message: "Unsafe URL" });
  }

  const $set = { ...value };

  // password change mapping → hash field
  if ("password" in value) {
    $set.passwordHash = value.password ? hashPassword(value.password) : null;
    delete $set.password;
  }
  if ("domain" in $set) $set.domain = ($set.domain || "").toLowerCase();

  // code rename uniqueness
  if (value.code) {
    const exists = await Link.findOne({ code: value.code });
    if (exists && String(exists._id) !== String(req.params.id)) {
      return res.status(409).json({ message: "Code already taken" });
    }
  }

  // refresh meta if longUrl changed (best-effort)
  if (value.longUrl) {
    try {
      const meta = await fetchPageMeta(value.longUrl);
      if (meta && typeof meta === "object") {
        if (meta.title) $set["meta.title"] = meta.title;
        if (meta.favicon) $set["meta.favicon"] = meta.favicon;
      }
    } catch {
      // ignore meta refresh failures
    }
  }

  const doc = await Link.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.user._id },
    { $set },
    { new: true }
  ).lean();

  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json({ ...doc, shortUrl: buildShortUrl(doc) });
});

/* ================================================================== */
/* Delete                                                              */
/* ================================================================== */
r.delete("/:id", async (req, res) => {
  await Link.deleteOne({ _id: req.params.id, ownerId: req.user._id });
  await Click.deleteMany({ linkId: req.params.id });
  res.json({ ok: true });
});

/* ================================================================== */
/* QR Generation                                                       */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Provide on-demand QR code for any link.
   Context: Useful for print or offline sharing; allows SVG/PNG output.
   Edge cases: Size clamped; content-type set for each format.            */
/* ------------------------------------------------------------------ */
r.get("/:id/qr", async (req, res) => {
  const format = (req.query.format || "png").toLowerCase();
  const size = Math.min(parseInt(req.query.size, 10) || QR_SIZE_DEFAULT, QR_SIZE_MAX);

  const link = await Link.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
  if (!link) return res.status(404).json({ message: "Not found" });

  const shortUrl = buildShortUrl(link);

  if (format === "svg") {
    const svg = await QRCode.toString(shortUrl, { type: "svg", width: size, margin: 2 });
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  }

  const buf = await QRCode.toBuffer(shortUrl, { type: "png", width: size, margin: 2 });
  res.setHeader("Content-Type", "image/png");
  return res.send(buf);
});

export default r;
