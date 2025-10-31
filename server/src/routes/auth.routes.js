/**
 * routes/auth.routes.js
 * Short: Registration, email verification, login, forgot/reset, and /me.
 */

import { Router } from "express";
import {
  loginSchema,
  registerSchema,
  verifySchema,
  forgotSchema,
  resetSchema,
} from "../utils/validators.js";
import { hashPassword, comparePassword } from "../utils/crypto.js";
import User from "../models/User.js";
import { sign, requireAuth } from "../middlewares/auth.js";
import { sendMail, codeEmailTemplate } from "../utils/mailer.js";
import { env } from "../config/env.js";

const r = Router();

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const VERIFY_CODE_EXP_MIN = 10;
const RESET_CODE_EXP_MIN = 10;

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
/**
 * Generate a 6-digit numeric string (000000–999999, non-leading-zero safe).
 * @returns {string}
 */
function sixDigits() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Add minutes to a Date without mutating original.
 * @param {Date} date
 * @param {number} mins
 * @returns {Date}
 */
function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

/**
 * Coerce any value into a Date.
 * @param {unknown} v
 * @returns {Date}
 */
function asDate(v) {
  return v instanceof Date ? v : new Date(v);
}

const now = () => Date.now();

/* ================================================================== */
/* Register                                                            */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Create account and send verification code.
   Context: Email must be unique; code expires quickly for safety.
   Edge cases: DEV mode returns code inline for easier testing.        */
/* ------------------------------------------------------------------ */
r.post("/register", async (req, res) => {
  const { value, error } = registerSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });

  const email = String(value.email).trim().toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email already in use" });

  const user = await User.create({
    name: String(value.name || "").trim(),
    email,
    passwordHash: hashPassword(value.password),
    emailVerified: false,
  });

  const code = sixDigits();
  user.verifyCode = code;
  user.verifyCodeExpires = addMinutes(new Date(), VERIFY_CODE_EXP_MIN);
  await user.save();

  try {
    const { text, html } = codeEmailTemplate({ title: "Verify your email", code });
    if (env.DEV_MAIL) {
      console.log("[DEV] VERIFY CODE for", email, "=>", code);
    } else {
      await sendMail(user.email, "Your verification code", text, html);
    }
  } catch (e) {
    console.error("[MAIL] register send failed:", e?.message || e);
  }

  const payload = { message: "Verification code sent. Please verify.", needVerify: true };
  if (env.DEV_MAIL) payload.devCode = code;
  res.json(payload);
});

/* ================================================================== */
/* Verify email                                                        */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Confirm email ownership with a short-lived code.
   Context: Avoids login until verified; deletes code after success.
   Edge cases: Mismatched or expired codes return generic 400.         */
/* ------------------------------------------------------------------ */
r.post("/verify", async (req, res) => {
  const { value, error } = verifySchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });

  const email = String(value.email).trim().toLowerCase();
  const inputCode = String(value.code ?? "").trim();

  const user = await User.findOne({ email }).select("+verifyCode +verifyCodeExpires");
  if (!user) return res.status(400).json({ message: "Account not found" });

  const storedCode = String(user.verifyCode ?? "");
  const expiresAt = asDate(user.verifyCodeExpires);

  if (!storedCode || !expiresAt || storedCode !== inputCode || expiresAt.getTime() < now()) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  user.emailVerified = true;
  user.verifyCode = null;
  user.verifyCodeExpires = null;
  await user.save();

  const token = sign(user);
  res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
});

/* ================================================================== */
/* Resend verification code                                            */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Re-issue verification code when user didn’t receive it.
   Context: Throttle elsewhere if needed; here we focus on success path.
   Edge cases: Already-verified accounts return a friendly message.    */
/* ------------------------------------------------------------------ */
r.post("/resend-verify", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Account not found" });
  if (user.emailVerified) return res.json({ message: "Already verified" });

  const code = sixDigits();
  user.verifyCode = code;
  user.verifyCodeExpires = addMinutes(new Date(), VERIFY_CODE_EXP_MIN);
  await user.save();

  try {
    const { text, html } = codeEmailTemplate({ title: "Verify your email", code });
    if (env.DEV_MAIL) {
      console.log("[DEV] VERIFY CODE for", email, "=>", code);
    } else {
      await sendMail(user.email, "Your verification code", text, html);
    }
  } catch (e) {
    console.error("[MAIL] resend failed:", e?.message || e);
  }

  const payload = { message: "Verification code re-sent" };
  if (env.DEV_MAIL) payload.devCode = code;
  res.json(payload);
});

/* ================================================================== */
/* Login                                                               */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Authenticate with email+password; block if unverified.
   Context: Prevents unverified logins; returns JWT on success.
   Edge cases: Generic errors for credential failures (no hints).      */
/* ------------------------------------------------------------------ */
r.post("/login", async (req, res) => {
  const { value, error } = loginSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });

  const email = String(value.email).trim().toLowerCase();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = comparePassword(value.password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  if (!user.emailVerified) {
    return res.status(403).json({ message: "Email not verified", code: "EMAIL_NOT_VERIFIED" });
  }

  const token = sign(user);
  res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
});

/* ================================================================== */
/* Forgot (send reset code)                                            */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Start password reset without leaking account status.
   Context: Always return 200 OK; only email if account exists.
   Edge cases: DEV mode returns code in response for testing.          */
/* ------------------------------------------------------------------ */
r.post("/forgot", async (req, res) => {
  const { value, error } = forgotSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });

  const email = String(value.email).trim().toLowerCase();
  const user = await User.findOne({ email });

  // Always respond OK (don’t leak account existence)
  if (!user) return res.json({ message: "If the email exists, a code has been sent." });

  const code = sixDigits();
  user.resetCode = code;
  user.resetCodeExpires = addMinutes(new Date(), RESET_CODE_EXP_MIN);
  await user.save();

  try {
    const { text, html } = codeEmailTemplate({
      title: "Reset your password",
      code,
      hint: "Use this code on the reset page.",
    });
    if (env.DEV_MAIL) {
      console.log("[DEV] RESET CODE for", email, "=>", code);
    } else {
      await sendMail(user.email, "Your password reset code", text, html);
    }
  } catch (e) {
    console.error("[MAIL] forgot failed:", e?.message || e);
  }

  const payload = { message: "If the email exists, a code has been sent." };
  if (env.DEV_MAIL) payload.devCode = code;
  res.json(payload);
});

/* ================================================================== */
/* Reset password                                                      */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Complete reset with code; mark email verified.
   Context: Treat successful reset as verification to reduce friction.
   Edge cases: Require exact code match and unexpired window.          */
/* ------------------------------------------------------------------ */
r.post("/reset", async (req, res) => {
  const { value, error } = resetSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.message });

  const email = String(value.email).trim().toLowerCase();
  const inputCode = String(value.code ?? "").trim();

  const user = await User.findOne({ email }).select(
    "+resetCode +resetCodeExpires +passwordHash +verifyCode +verifyCodeExpires"
  );
  if (!user || !user.resetCode || !user.resetCodeExpires) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  const storedCode = String(user.resetCode ?? "");
  const expiresAt = asDate(user.resetCodeExpires);

  if (storedCode !== inputCode || expiresAt.getTime() < now()) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  user.passwordHash = hashPassword(value.newPassword);
  user.resetCode = null;
  user.resetCodeExpires = null;
  user.verifyCode = null;
  user.verifyCodeExpires = null;
  user.emailVerified = true; // consider reset as verified
  await user.save();

  res.json({ message: "Password updated. You can log in now." });
});

/* ================================================================== */
/* Me                                                                  */
/* ================================================================== */
r.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: { _id: req.user._id, name: req.user.name, email: req.user.email },
  });
});

export default r;
