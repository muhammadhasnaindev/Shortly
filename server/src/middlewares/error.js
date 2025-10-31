/**
 * errors.js
 * Short: 404 and centralized error handler.

 */

 /* ----------------------------------------------------------------- */
 /* [PRO] Purpose: Send a consistent 404 shape for unknown routes.
    Context: Helps clients rely on a stable error payload.
    Edge cases: JSON-only APIs; no HTML fallbacks.
    Notes: Keep minimal to avoid leaking internals.                   */
 /* ----------------------------------------------------------------- */
export function notFound(_req, res) {
  res.status(404).json({ message: "Not found" });
}

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Final error boundary that does not leak internals.
   Context: Uncaught route/middleware errors end up here.
   Edge cases: Non-Error throws; still log and return 500 JSON.
   Notes: Add per-env detail only if strictly required.               */
/* ------------------------------------------------------------------ */
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ message: "Server error" });
}
