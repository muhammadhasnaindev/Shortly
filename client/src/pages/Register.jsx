/**
 * Register — account creation with email verification
 *
 * Summary:
 * - Step 1: name/email/password submission.
 * - Step 2: 6-digit email verification; if token returned, persists and redirects.
 
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/axios";
import PasswordInput from "../components/PasswordInput";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const MIN_PW = 6;
const CODE_LEN = 6;
const MSG = {
  REG_FAIL: "Registration failed",
  VERIFY_FAIL: "Verification failed",
  INVALID_CODE: "Invalid/expired code",
  PW_LEN: `Password must be at least ${MIN_PW} characters`,
  PW_MISMATCH: "Passwords do not match",
};
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [confirmErr, setConfirmErr] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ---------------------------------------------
     [PRO] Purpose:
     Local password validation before hitting API.

     Context:
     Keeps UI message immediate; avoids unnecessary request.

     Edge cases:
     Confirms both length and equality; clears mismatch on success.
  ---------------------------------------------- */
  const validate = () => {
    if (form.password.length < MIN_PW) return MSG.PW_LEN;
    if (form.password !== form.confirm) {
      setConfirmErr(MSG.PW_MISMATCH);
      return MSG.PW_MISMATCH;
    }
    setConfirmErr("");
    return "";
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setErr("");
    const v = validate();
    if (v) return setErr(v);
    setLoading(true);
    try {
      await api.post("/auth/register", {
        name: form.name,
        email: normalizeEmail(form.email),
        password: form.password,
      });
      setStep(2);
    } catch (e1) {
      setErr(e1?.response?.data?.message || MSG.REG_FAIL);
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const codeTrim = String(code).replace(/\D/g, "").slice(0, CODE_LEN);
      const { data } = await api.post("/auth/verify", {
        email: normalizeEmail(form.email),
        code: codeTrim,
      });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        // prime axios header for immediate authed calls
        api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        navigate("/");
      } else {
        setErr(MSG.VERIFY_FAIL);
      }
    } catch (e1) {
      setErr(e1?.response?.data?.message || MSG.INVALID_CODE);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post("/auth/resend-verify", { email: normalizeEmail(form.email) });
    } catch {}
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="mx-auto max-w-md p-6 card w-full">
        {step === 1 ? (
          <>
            <h1 className="text-xl font-semibold mb-4">Create account</h1>
            <form onSubmit={submitRegister} className="space-y-4" noValidate>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                  className="input"
                />
              </div>
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
                />
              </div>
              <PasswordInput
                name="password"
                value={form.password}
                onChange={onChange}
                label="Password"
                placeholder={`At least ${MIN_PW} characters`}
                required
                autoComplete="new-password"
              />
              <PasswordInput
                name="confirm"
                value={form.confirm}
                onChange={onChange}
                label="Confirm password"
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
                error={confirmErr}
              />
              {err ? <p className="text-sm text-[var(--error)]">{err}</p> : null}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Creating..." : "Create account"}
              </button>
              <div className="text-sm text-muted text-center">
                Already have an account?{" "}
                <Link to="/login" className="text-[color:var(--primary)] hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-2">Verify your email</h1>
            <p className="text-sm text-muted mb-4">
              We sent a 6-digit code to <b>{form.email}</b>. Enter it below.
            </p>
            <form onSubmit={verifyEmail} className="space-y-4" noValidate>
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
                  inputMode="numeric"
                  pattern="\d{6}"
                  required
                  aria-label="6-digit verification code"
                />
              </div>
              {err ? <p className="text-sm text-[var(--error)]">{err}</p> : null}
              <button
                type="submit"
                disabled={loading || code.length !== CODE_LEN}
                className="btn-primary w-full disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
              <div className="text-sm text-muted text-center">
                Didn’t get it?{" "}
                <button type="button" onClick={resend} className="underline" aria-label="Resend code">
                  Resend code
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
