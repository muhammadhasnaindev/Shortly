/**
 * env.js
 * Short: Centralized environment parsing and validation for server config.

 */

import dotenv from "dotenv";
dotenv.config();

/* ------------------------------------------------------------------ */
/* Constants (avoid magic numbers)                                    */
/* ------------------------------------------------------------------ */
const DEF_NODE_ENV = "development";
const DEF_PORT = 5000;
const DEF_LOCAL_MONGO = "mongodb://127.0.0.1:27017/shortly";
const DEF_JWT_SECRET = "dev_jwt_secret";
const DEF_COOKIE_SECRET = "dev_cookie_secret";
const DEF_CLIENT_ORIGIN = "http://localhost:5173";

const DEF_SMTP_HOST = "smtp.gmail.com";
const DEF_SMTP_PORT_SSL = 465; // 465 = SSL by default
const DEF_SMTP_SECURE = true;  // true for 465, false for 587

const DEF_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEF_RATE_LIMIT_MAX = 300;

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */
/**
 * Check if a string still contains placeholder-style tokens (e.g., <user>).
 * @param {string} str
 * @returns {boolean}
 */
function hasPlaceholders(str) {
  return /<\s*[^>]+>/.test(String(str || ""));
}

/**
 * Parse comma-separated origins into a string array.
 * @param {string} input
 * @returns {string[]}
 */
function parseOrigins(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Convert a value to boolean with default.
 * @param {unknown} v
 * @param {boolean} def
 * @returns {boolean}
 */
function toBool(v, def = false) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return def;
  return ["1", "true", "yes", "y", "on"].includes(s);
}

/**
 * Convert a value to number with default.
 * @param {unknown} v
 * @param {number} def
 * @returns {number}
 */
function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* ------------------------------------------------------------------ */
/* Environment values                                                  */
/* ------------------------------------------------------------------ */
/**
 * Parsed and validated environment configuration for the server.
 * Prefer reading from here instead of `process.env` directly.
 */
export const env = {
  // App
  NODE_ENV: process.env.NODE_ENV || DEF_NODE_ENV,
  PORT: toNum(process.env.PORT, DEF_PORT),
  BASE_PUBLIC_URL:
    process.env.BASE_PUBLIC_URL || `http://localhost:${process.env.PORT || DEF_PORT}`,

  // Database
  MONGO_URI: process.env.MONGO_URI || DEF_LOCAL_MONGO,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || DEF_JWT_SECRET,
  COOKIE_SECRET: process.env.COOKIE_SECRET || DEF_COOKIE_SECRET,

  // CORS
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || DEF_CLIENT_ORIGIN,
  CLIENT_ORIGINS: parseOrigins(
    process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || ""
  ),

  // SMTP (Gmail App Password recommended)
  SMTP_HOST: process.env.SMTP_HOST || DEF_SMTP_HOST,
  SMTP_PORT: toNum(process.env.SMTP_PORT, DEF_SMTP_PORT_SSL), // 465 = SSL by default
  SMTP_SECURE: toBool(process.env.SMTP_SECURE, DEF_SMTP_SECURE), // true for 465, false for 587
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "",
  // When true, we never attempt real SMTP — verification codes are logged instead
  DEV_MAIL: toBool(process.env.DEV_MAIL, false),

  // Optional infra
  REDIS_URL: process.env.REDIS_URL || "",

  // Optional rate limiting
  RATE_LIMIT_WINDOW_MS: toNum(process.env.RATE_LIMIT_WINDOW_MS, DEF_RATE_LIMIT_WINDOW_MS),
  RATE_LIMIT_MAX: toNum(process.env.RATE_LIMIT_MAX, DEF_RATE_LIMIT_MAX),

  // Feature flags (optional)
  ALLOW_SIGNUPS: toBool(process.env.ALLOW_SIGNUPS, true),
};

/* ------------------------------------------------------------------ */
/* Basic Validation                                                    */
/* ------------------------------------------------------------------ */
const errors = [];

// Mongo
if (!env.MONGO_URI) {
  errors.push("Missing MONGO_URI in environment.");
} else if (hasPlaceholders(env.MONGO_URI)) {
  errors.push("MONGO_URI still has placeholders (<user>/<pass>/<cluster>/<db>).");
}

// Secrets
if (env.NODE_ENV === "production") {
  if (!env.JWT_SECRET || env.JWT_SECRET === DEF_JWT_SECRET) {
    errors.push("JWT_SECRET is missing or weak in production.");
  }
  if (!env.COOKIE_SECRET || env.COOKIE_SECRET === DEF_COOKIE_SECRET) {
    errors.push("COOKIE_SECRET is missing or weak in production.");
  }
}

// SMTP (only enforce if not in DEV_MAIL mode)
if (env.NODE_ENV === "production" && !env.DEV_MAIL) {
  if (!env.SMTP_HOST) errors.push("SMTP_HOST is required when DEV_MAIL is off.");
  if (!env.SMTP_USER) errors.push("SMTP_USER is required when DEV_MAIL is off.");
  if (!env.SMTP_PASS) errors.push("SMTP_PASS is required when DEV_MAIL is off.");
  if (!env.SMTP_FROM) errors.push("SMTP_FROM is required when DEV_MAIL is off.");
}

// CORS warnings (non-fatal)
if (!env.CLIENT_ORIGIN && env.CLIENT_ORIGINS.length === 0) {
  console.warn("CLIENT_ORIGIN/CLIENT_ORIGINS not set. Configure to avoid CORS issues.");
}

// Port/secure sanity (non-fatal)
if (env.SMTP_PORT === 465 && !env.SMTP_SECURE) {
  console.warn("SMTP_SECURE=false while port is 465 (SSL). Consider SMTP_SECURE=true.");
}
if (env.SMTP_PORT === 587 && env.SMTP_SECURE) {
  console.warn("SMTP_SECURE=true while port is 587 (STARTTLS). Consider SMTP_SECURE=false.");
}

if (errors.length) {
  throw new Error("Environment validation failed:\n- " + errors.join("\n- "));
}
