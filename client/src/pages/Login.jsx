/**
 * Login — email/password auth with optional email verification step
 *
 * Summary:
 * - Submits credentials, stores token+user, primes axios Authorization header, and redirects.
 * - If email is unverified (403 + EMAIL_NOT_VERIFIED), shows a verification code prompt.

 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/axios";
import PasswordInput from "../components/PasswordInput";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const CODE_LEN = 6;
const MSG = {
  LOGIN_FAIL: "Login failed. Please try again.",
  INVALID: "Invalid credentials",
  VERIFY_FAIL: "Verification failed",
};

/* ---------------------------------------------
   [PRO] Purpose:
   Normalize inputs and centralize post-auth side effects.

   Context:
   Prevents scattered lowercasing, storage, and axios header updates.

   Edge cases:
   Tokenless responses result in a safe no-op.

   Notes:
   Behavior unchanged vs original; just tidier.
---------------------------------------------- */
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
function afterAuth(data, fallbackEmail, navigate) {
  if (data?.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user || { email: fallbackEmail }));
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    navigate("/");
    return true;
  }
  return false;
}

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [needVerify, setNeedVerify] = useState(false);
  const [code, setCode] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ---------------------------------------------
     [PRO] Purpose:
     Submit credentials; set session or request email verification.

     Context:
     Maintains original status-based EMAIL_NOT_VERIFIED flow.

     Edge cases:
     Shows generic invalid message unless API passes a message; toggles verify step on 403/email.
  ---------------------------------------------- */
  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setNeedVerify(false);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email: normalizeEmail(form.email),
        password: form.password,
      });
      if (!afterAuth(data, form.email, navigate)) {
        setErr(MSG.LOGIN_FAIL);
      }
    } catch (e1) {
      const s = e1?.response?.status;
      const msg = e1?.response?.data?.message || MSG.INVALID;
      setErr(msg);
      if (s === 403 && e1?.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedVerify(true);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------
     [PRO] Purpose:
     Verify email with 6-digit code and finish login.

     Context:
     Code is sanitized to digits; length validated before API call.

     Edge cases:
     Shows API message on failure; otherwise generic verify failure.
  ---------------------------------------------- */
  const verifyNow = async (e) => {
    e.preventDefault();
    setErr("");
    const codeTrim = String(code).trim();
    if (!/^\d{6}$/.test(codeTrim)) {
      return setErr("Enter the 6-digit verification code");
    }
    try {
      const { data } = await api.post("/auth/verify", {
        email: normalizeEmail(form.email),
        code: codeTrim,
      });
      afterAuth(data, form.email, navigate);
    } catch (e1) {
      setErr(e1?.response?.data?.message || MSG.VERIFY_FAIL);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="mx-auto max-w-md p-6 card w-full">
        <h1 className="text-xl font-semibold mb-4">Login</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="input"
              aria-label="Email address"
            />
          </div>

          <PasswordInput
            name="password"
            value={form.password}
            onChange={onChange}
            label="Password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          {err ? <p className="text-sm text-[var(--error)]">{err}</p> : null}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-sm text-muted flex items-center justify-between mt-1">
            <Link to="/register" className="text-[color:var(--primary)] hover:underline">
              Create account
            </Link>
            <Link to="/forgot-password" className="text-[color:var(--primary)] hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>

        {needVerify && (
          <div className="mt-5 border-t pt-4">
            <div className="text-sm font-medium mb-2">Verify your email to continue</div>
            <form onSubmit={verifyNow} className="space-y-3" noValidate>
              <input
                className="input"
                placeholder="6-digit code"
                value={code}
                maxLength={CODE_LEN}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))}
                inputMode="numeric"
                pattern="\d{6}"
                aria-label="6-digit code"
                required
              />
              <button type="submit" className="btn-primary w-full" disabled={code.length !== CODE_LEN}>
                Verify now
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
