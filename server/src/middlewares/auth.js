/**
 * auth.js
 * Short: JWT sign + auth guard. Attaches `req.user` on success.
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Normalize Authorization parsing across clients.
   Context: Some clients send "bearer", others "Bearer".
   Edge cases: Missing header, extra spaces, non-Bearer schemes.
   Notes: Keep tiny + dependency-free.                               */
/* ------------------------------------------------------------------ */
function getBearerToken(headerValue) {
  const h = String(headerValue || "").trim();
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

const TOKEN_TTL = "7d";

/**
 * Create a signed JWT for a user (subject = user._id).
 * @param {{ _id: string, email?: string }} user
 * @returns {string} JWT string
 */
export function sign(user) {
  return jwt.sign(
    { sub: user._id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Verify JWT and attach `req.user` from DB.
   Context: Uses `.lean()` to reduce overhead on hot paths.
   Edge cases: Deleted user, expired or malformed token.
   Notes: Client gets generic 401; details only in server logs.       */
/* ------------------------------------------------------------------ */
export async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}
