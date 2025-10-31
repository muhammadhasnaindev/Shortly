/**
 * utils/crypto.js
 * Short: Password hashing/verification and privacy-friendly IP hashing.

 */

import bcrypt from "bcryptjs";
import shajs from "sha.js";
import { env } from "../config/env.js";

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const BCRYPT_ROUNDS = 10;

/**
 * Hash the given password using bcrypt (defensively coerces to string).
 * @param {unknown} pwd
 * @returns {string}
 */
export const hashPassword = (pwd) => bcrypt.hashSync(String(pwd || ""), BCRYPT_ROUNDS);

/**
 * Safe compare: never throws.
 * - Returns false if pwd/hash are missing
 * - Catches bcrypt errors (e.g., "Invalid salt")
 * @param {unknown} pwd
 * @param {unknown} hash
 * @returns {boolean}
 */
export const comparePassword = (pwd, hash) => {
  if (!pwd || !hash || typeof hash !== "string") return false;
  try {
    return bcrypt.compareSync(String(pwd), hash);
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Privacy-friendly IP hash that rotates daily.
   Context: Mixes IP + secret + date (YYYY-MM-DD); 32 hex chars.
   Edge cases: Missing/invalid inputs coerce to strings safely.        */
/* ------------------------------------------------------------------ */
/**
 * @param {string} ip
 * @returns {string} 32-char hex digest
 */
export function ipHash(ip) {
  const day = new Date().toISOString().slice(0, 10);
  return shajs("sha256").update(`${ip}|${env.JWT_SECRET}|${day}`).digest("hex").slice(0, 32);
}
