/**
 * utils/validators.js
 * Short: Joi schemas + small validators for URLs and link payloads.

 */

import Joi from "joi";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */
const MAX_NOTES_LEN = 1000;
const MIN_PASSWORD_LEN = 4;
const MAX_PASSWORD_LEN = 128;
const MIN_USER_PASSWORD_LEN = 6;
const MAX_USER_PASSWORD_LEN = 100;
const MAX_CLICKS_CAP = 10_000_000;

/* ================================================================== */
/* URL Safety                                                          */
/* ================================================================== */
const privateNets = [
  /^http(s)?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
  /^http(s)?:\/\/10\./,
  /^http(s)?:\/\/192\.168\./,
  /^http(s)?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^javascript:/i,
];

/**
 * Basic URL safety check:
 * - Must be http/https
 * - Must not target private networks or javascript: URLs
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  return !privateNets.some((re) => re.test(u));
}

/* ================================================================== */
/* Auth Schemas                                                        */
/* ================================================================== */
export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(MIN_USER_PASSWORD_LEN).max(MAX_USER_PASSWORD_LEN).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const verifySchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required(),
});

export const forgotSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(MIN_USER_PASSWORD_LEN).max(MAX_USER_PASSWORD_LEN).required(),
});

/* ================================================================== */
/* Link Schemas                                                        */
/* ================================================================== */
// slug: allow a-z A-Z 0-9 _ -
const slug = Joi.string().pattern(/^[a-zA-Z0-9_-]{4,32}$/);

export const createLinkSchema = Joi.object({
  longUrl: Joi.string().uri().required(),
  code: slug.optional().allow(""),
  notes: Joi.string().max(MAX_NOTES_LEN).allow("", null),
  expiresAt: Joi.date().optional().allow(null),
  password: Joi.string().min(MIN_PASSWORD_LEN).max(MAX_PASSWORD_LEN).allow("", null),
  maxClicks: Joi.number().integer().min(0).max(MAX_CLICKS_CAP).default(0),
  domain: Joi.string().pattern(/^[a-z0-9.-]+$/i).allow("", null),
});

export const updateLinkSchema = Joi.object({
  longUrl: Joi.string().uri().optional(),
  notes: Joi.string().max(MAX_NOTES_LEN).allow("", null).optional(),
  isActive: Joi.boolean().optional(),
  expiresAt: Joi.date().allow(null).optional(),
  password: Joi.string().min(MIN_PASSWORD_LEN).max(MAX_PASSWORD_LEN).allow("", null),
  maxClicks: Joi.number().integer().min(0).max(MAX_CLICKS_CAP).optional(),
  domain: Joi.string().pattern(/^[a-z0-9.-]+$/i).allow("", null),
  code: slug.optional(),
});
