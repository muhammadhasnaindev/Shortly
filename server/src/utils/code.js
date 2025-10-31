/**
 * utils/code.js
 * Short: Generate short, URL-safe codes for links.

 */

import { customAlphabet } from "nanoid";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 7; // e.g., abc12XY

const nano = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

/**
 * Generate a short code suitable for URLs.
 * @returns {string}
 */
export function genCode() {
  return nano();
}
