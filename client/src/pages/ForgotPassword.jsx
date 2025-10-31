/**
 * ForgotPassword — request reset code and set a new password
 *
 * Summary:
 * - Step 1: submit email to receive a verification code.
 * - Step 2: enter code and new password, then redirect to login.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axios";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const MIN_PW = 6;
const CODE_LEN = 6;
const REDIRECT_MS = 800;
const MSG = {
  REQ_FAIL: "Request failed",
  RESET_FAIL: "Reset failed",
  PW_SHORT: `Password must be at least ${MIN_PW} characters`,
  PW_MISMATCH: "Passwords do not match",
  CODE_HINT: "If the email exists, a code has been sent.",
  UPDATED: "Password updated. Redirecting to login…",
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* ---------------------------------------------
     [PRO] Purpose:
     Send password reset email (step 1).

     Context:
     Uses normalized lower-case email.

     Edge cases:
     Server hides existence; we show generic message.
  ---------------------------------------------- */
  const send = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.post("/auth/forgot", { email: String(email).trim().toLowerCase() });
      setMsg(MSG.CODE_HINT);
      setStep(2);
    } catch (e1) {
      setErr(e1?.response?.data?.message || MSG.REQ_FAIL);
    }
  };

  /* ---------------------------------------------
     [PRO] Purpose:
     Verify code and set the new password.

     Context:
     Enforces local length/match checks before calling API.

     Edge cases:
     Code must be exactly 6 digits; trims inputs.

     Notes:
     Redirects after a short delay to allow the message to be read.
  ---------------------------------------------- */
  const reset = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (pw.a.length < MIN_PW) return setErr(MSG.PW_SHORT);
    if (pw.a !== pw.b) return setErr(MSG.PW_MISMATCH);

    const codeTrim = String(code).trim();
    if (!/^\d{6}$/.test(codeTrim)) {
      return setErr("Enter the 6-digit verification code");
    }

    try {
      await api.post("/auth/reset", {
        email: String(email).trim().toLowerCase(),
        code: codeTrim,
        newPassword: pw.a,
      });
      setMsg(MSG.UPDATED);
      setTimeout(() => navigate("/login"), REDIRECT_MS);
    } catch (e1) {
      setErr(e1?.response?.data?.message || MSG.RESET_FAIL);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="mx-auto max-w-md p-6 card w-full">
        <h1 className="text-xl font-semibold mb-4">Forgot password</h1>

        {step === 1 ? (
          <form onSubmit={send} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                aria-label="Email address"
              />
            </div>
            {err && <p className="text-sm text-[var(--error)]">{err}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
            <button className="btn-primary w-full" type="submit" aria-label="Send reset code">
              Send code
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="code">
                Verification code
              </label>
              <input
                id="code"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))}
                maxLength={CODE_LEN}
                placeholder="123456"
                required
                inputMode="numeric"
                pattern="\d{6}"
                aria-label="6-digit code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="pw1">
                New password
              </label>
              <input
                id="pw1"
                className="input"
                type="password"
                value={pw.a}
                onChange={(e) => setPw((s) => ({ ...s, a: e.target.value }))}
                required
                autoComplete="new-password"
                minLength={MIN_PW}
                aria-label="New password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="pw2">
                Confirm password
              </label>
              <input
                id="pw2"
                className="input"
                type="password"
                value={pw.b}
                onChange={(e) => setPw((s) => ({ ...s, b: e.target.value }))}
                required
                autoComplete="new-password"
                minLength={MIN_PW}
                aria-label="Confirm password"
              />
            </div>
            {err && <p className="text-sm text-[var(--error)]">{err}</p>}
            {msg && <p className="text-sm text-green-600">{msg}</p>}
            <button className="btn-primary w-full" type="submit" aria-label="Reset password">
              Reset password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
