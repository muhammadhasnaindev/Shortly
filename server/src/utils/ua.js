/**
 * utils/ua.js
 * Short: Parse user-agent into coarse device + browser info.
 
 */

import UAParser from "ua-parser-js";

/**
 * Parse a user-agent string into { device, browser }.
 * @param {string} ua
 * @returns {{ device: string, browser: string }}
 */
export function parseUA(ua) {
  try {
    const p = new UAParser(ua || "");
    const dev = p.getDevice()?.type || "desktop";
    return {
      device: dev || "other",
      browser: p.getBrowser()?.name || "Unknown",
    };
  } catch {
    return { device: "other", browser: "Unknown" };
  }
}
