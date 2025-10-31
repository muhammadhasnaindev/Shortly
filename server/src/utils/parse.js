/**
 * utils/parse.js
 * Short: Small parsers for query params (e.g., UTM).


 */

const UTM_MAX_LEN = 64;

/**
 * Parse UTM parameters from a request query.
 * @param {Record<string, unknown>} query
 * @returns {{source?: string, medium?: string, campaign?: string} | undefined}
 */
export function parseUTM(query) {
  const { utm_source, utm_medium, utm_campaign } = query || {};
  const obj = {};
  if (utm_source) obj.source = String(utm_source).slice(0, UTM_MAX_LEN);
  if (utm_medium) obj.medium = String(utm_medium).slice(0, UTM_MAX_LEN);
  if (utm_campaign) obj.campaign = String(utm_campaign).slice(0, UTM_MAX_LEN);
  return Object.keys(obj).length ? obj : undefined;
}
