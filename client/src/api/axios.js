/**
 * api/axios — axios instance for client API calls
 *
 * Summary:
 * - Creates a preconfigured axios client with baseURL and bearer injection from localStorage.
 * - Centralizes auth token read/clear, and redirects to /login on 401 (outside auth pages).

 */

import axios from "axios";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const RAW_API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, ""); // strip trailing slashes
const AUTH_PAGES = ["/login", "/register"];
const REQUEST_TIMEOUT_MS = 20000;

/* ---------------------------------------------
   [PRO] Purpose:
   Wrap token access & clearing so both interceptors and other modules use the same logic.

   Context:
   Token was read inline in the interceptor; moving to helpers reduces duplication and clarifies intent.

   Edge cases:
   LocalStorage may be empty or unavailable; helpers return safe fallbacks.

   Notes:
   These helpers don’t change behavior; they just centralize it.
---------------------------------------------- */
function getAuthToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    // ignore storage errors; redirect will still clear session effectively
  }
}

/* ---------------------------------------------
   [PRO] Purpose:
   Detect if current route is already an auth page to avoid redirect loops.

   Context:
   Previous logic inlined the check; extracting improves readability and keeps the allowlist in one place.

   Edge cases:
   Handles undefined window/location in odd runtimes by safe fallbacks.

   Notes:
   Update AUTH_PAGES when you add /forgot or /reset flows.
---------------------------------------------- */
function isOnAuthPage() {
  try {
    const path = window.location?.pathname || "";
    return AUTH_PAGES.some((p) => path.startsWith(p));
  } catch {
    return false;
  }
}

/* ---------------------------------------------
   Axios instance
---------------------------------------------- */
export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: false, // bearer-token flow (no cookies)
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

/* ---------------------------------------------
   [PRO] Purpose:
   Inject Authorization header when a token is present.

   Context:
   Previously set headers inline; now uses helper for token retrieval.

   Edge cases:
   Ensures headers object exists; skips empty tokens.

   Notes:
   Keeps behavior identical; only structure is tidier.
---------------------------------------------- */
api.interceptors.request.use((cfg) => {
  const token = getAuthToken();
  if (token) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let handling401 = false;

/* ---------------------------------------------
   [PRO] Purpose:
   On 401 from server (and not on an auth page), clear session and hard-redirect to /login.

   Context:
   Matches previous behavior but adds guards for network/timeout cases (no HTTP status)
   and centralizes auth-page detection.

   Edge cases:
   - Network/timeout: err.response may be undefined; skip redirect.
   - Multiple concurrent 401s: guarded by handling401 flag until reload.
   - If already on /login or /register: do nothing.

   Notes:
   Hard replace avoids SPA state leaks; page reload resets handling401.
---------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    // Guard: ignore non-HTTP failures (network/timeout/canceled)
    if (!status) {
      return Promise.reject(err);
    }

    if (status === 401 && !handling401 && !isOnAuthPage()) {
      handling401 = true;
      clearAuth();
      try {
        window.location.replace("/login");
      } catch {
        // If replace fails (unusual), still reject so caller can handle.
      }
    }

    return Promise.reject(err);
  }
);

/* ---------------------------------------------
   Public exports
---------------------------------------------- */
export const publicBase = API_BASE;
export default api;
