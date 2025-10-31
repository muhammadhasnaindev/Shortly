/**
 * utils/meta.js
 * Short: Best-effort metadata fetch (<title>, favicon) with timeout.
 */

import * as cheerio from "cheerio";
import fetch from "node-fetch";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */
const FETCH_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Resolve minimal page metadata for nicer link cards.
   Context: Don’t block link creation on metadata failures.
   Edge cases: Invalid HTML, relative favicon, slow servers → timeout.  */
/* ------------------------------------------------------------------ */
/**
 * Best-effort metadata fetch: <title> and favicon.
 * Returns { title?: string, favicon?: string }
 * @param {string} urlStr
 * @returns {Promise<Record<string,string>>}
 */
export async function fetchPageMeta(urlStr) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(urlStr, { redirect: "follow", signal: controller.signal });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Title
    let title = ($("title").first().text() || "").trim();
    if (!title) title = $('meta[property="og:title"]').attr("content") || "";

    // Favicon (try <link rel="icon"> etc., else /favicon.ico)
    const linkIcon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href") ||
      "/favicon.ico";

    const u = new URL(urlStr);
    let favicon;
    try {
      favicon = new URL(linkIcon, `${u.protocol}//${u.host}`).toString();
    } catch {
      favicon = `${u.protocol}//${u.host}/favicon.ico`;
    }

    const meta = {};
    if (title) meta.title = title.slice(0, 200);
    if (favicon) meta.favicon = favicon;
    return meta;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}
