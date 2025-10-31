/**
 * CreateLinkModal — create/edit short links with validation and helpful UX
 *
 * Summary:
 * - Manages URL/code/domain/expiry/password fields with live validation and preview.
 * - Calls POST/PATCH to /links, shows toasts, and auto-copies the final short URL when appropriate.
 */

import React, { useEffect, useMemo, useState } from "react";
import PasswordInput from "./PasswordInput";
import { api } from "../api/axios";
import { useUI } from "../store/ui";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const HOST_RE = /^[a-z0-9.-]+$/i;
const CODE_RE = /^[a-zA-Z0-9_-]{4,32}$/;

const DUR = {
  H1: 60 * 60 * 1000,
  D1: 24 * 60 * 60 * 1000,
  D7: 7 * 24 * 60 * 60 * 1000,
  D30: 30 * 24 * 60 * 60 * 1000,
};

const MSG = {
  URL_INVALID: "Invalid URL format.",
  URL_PUBLIC: "Please provide a valid public URL.",
  URL_LOCAL: "Please provide a public URL (not a local/LAN URL).",
  EXP_PAST: "Expiry must be now or in the future.",
  CODE_FMT: "Use 4–32 characters: letters, numbers, _ or -",
  DOMAIN_FMT: "Host only (e.g., go.example.com)",
  PASS_REQ: "Set a link password of at least 4 characters",
  MAX_NUM: "Enter a number ≥ 0",
  SAVE_FAIL: "Failed to save link",
};

const STATUS_TO_CLASS = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  fail: "text-red-500",
  checking: "text-blue-500",
  idle: "text-muted",
};

/* ---------------------------------------------
   [PRO] Purpose:
   Keep date helpers small and predictable for input[type=datetime-local].

   Context:
   Avoid scattered date math; rounding minutes ensures consistent min/compare.

   Edge cases:
   Local timezone offsets are respected; seconds/ms zeroed.

   Notes:
   Works in browser environments; no server-time dependency.
---------------------------------------------- */
function nowRoundedToMinute() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}
function toLocalDatetimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
function isPast(dtStr) {
  if (!dtStr) return false;
  return new Date(dtStr).getTime() < nowRoundedToMinute().getTime();
}

/* ---------------------------------------------
   [PRO] Purpose:
   Centralize small parsing/origin helpers to reduce inline logic.

   Context:
   Reused in multiple places; keeps render body tidy.

   Edge cases:
   window may be undefined (non-browser); fallbacks are safe.

   Notes:
   No behavior change vs original.
---------------------------------------------- */
function parseNonNegativeInt(v) {
  if (v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? NaN : n;
}
function getOriginForPreview(domain) {
  if (domain) return `https://${domain}`;
  try {
    return window.location.origin;
  } catch {
    return "https://example.com";
  }
}

/**
 * CreateLinkModal component
 * @param {{ onClose?: () => void, onCreated?: (data:any)=>void, linkData?: any }} props
 */
export default function CreateLinkModal({ onClose, onCreated, linkData }) {
  const { showToast } = useUI();
  const isEdit = !!linkData;

  const [form, setForm] = useState({
    longUrl: linkData?.longUrl || "",
    code: linkData?.code || "",
    notes: linkData?.notes || "",
    protect: false,
    linkPassword: "",
    expiresAt: linkData?.expiresAt ? toLocalDatetimeInputValue(new Date(linkData.expiresAt)) : "",
    domain: linkData?.domain || "",
    maxClicks: typeof linkData?.maxClicks === "number" ? linkData.maxClicks : 0,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expiryErr, setExpiryErr] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [domainErr, setDomainErr] = useState("");
  const [maxErr, setMaxErr] = useState("");

  const [domainTest, setDomainTest] = useState({ status: "idle", message: "" });

  const minLocal = useMemo(() => toLocalDatetimeInputValue(nowRoundedToMinute()), []);
  const shortPreview = useMemo(() => {
    const origin = getOriginForPreview(form.domain);
    const slug = form.code && CODE_RE.test(form.code) ? form.code : "my-campaign";
    return `${origin}/r/${slug}`;
  }, [form.code, form.domain]);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && !loading && onClose?.();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [loading, onClose]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    if (name === "expiresAt") setExpiryErr(val && isPast(val) ? MSG.EXP_PAST : "");
    if (name === "code") setCodeErr(val && !CODE_RE.test(val) ? MSG.CODE_FMT : "");
    if (name === "domain") {
      setDomainErr(val && !HOST_RE.test(val) ? MSG.DOMAIN_FMT : "");
      setDomainTest({ status: "idle", message: "" });
    }
    if (name === "maxClicks") {
      const num = Number(val);
      setMaxErr(Number.isNaN(num) || num < 0 ? MSG.MAX_NUM : "");
    }
    setForm((f) => ({ ...f, [name]: val }));
  }

  function clearExpiry() {
    setForm((f) => ({ ...f, expiresAt: "" }));
    setExpiryErr("");
  }

  /* ---------------------------------------------
     [PRO] Purpose:
     Validate destination URLs for basic format and public reachability.

     Context:
     Prevents javascript: and local network URLs.

     Edge cases:
     Malformed URLs throw; blocked schemes return user-safe messages.

     Notes:
     Keep messages short for UI.
  ---------------------------------------------- */
  function validateUrl(url) {
    try {
      new URL(url);
      if (/^javascript:/i.test(url)) return MSG.URL_PUBLIC;
      if (
        /(^https?:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.))/i.test(url)
      )
        return MSG.URL_LOCAL;
      return "";
    } catch {
      return MSG.URL_INVALID;
    }
  }

  /* ---------------------------------------------
     [PRO] Purpose:
     Verify that custom domain routes to backend /r/* paths.

     Context:
     First PNG probe avoids CORS issues; then JSON probe if possible.

     Edge cases:
     DNS/proxy issues reported as 'fail'; CORS-only issues downgraded to 'warn'.

     Notes:
     Button is disabled while checking to avoid parallel probes.
  ---------------------------------------------- */
  async function testDomain() {
    const host = (form.domain || "").trim();
    if (!host || !HOST_RE.test(host)) {
      setDomainTest({ status: "fail", message: "Enter a valid host like go.example.com" });
      return;
    }
    setDomainTest({ status: "checking", message: "Checking…" });
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = `https://${host}/r/_health.png?ts=${Date.now()}`;
      });
      let jsonOk = false;
      try {
        const res = await fetch(`https://${host}/r/_health`, { mode: "cors" });
        jsonOk = res.ok;
      } catch {}
      if (jsonOk) setDomainTest({ status: "ok", message: "Domain routes /r/* correctly." });
      else setDomainTest({ status: "warn", message: "PNG ok. JSON blocked by CORS (acceptable)." });
    } catch {
      setDomainTest({
        status: "fail",
        message: "Health PNG failed — DNS/proxy not pointing to backend.",
      });
    }
  }

  /* ---------------------------------------------
     [PRO] Purpose:
     Validate, submit payload to API, toast result, and optionally copy short URL.

     Context:
     Same behavior as before; minor refactors for clarity and safety.

     Edge cases:
     Clipboard may fail; slug may change on edit; number parsing guarded.

     Notes:
     Keeps payload shape identical for server compatibility.
  ---------------------------------------------- */
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const v = validateUrl(form.longUrl);
    if (v) return setErr(v);
    if (form.expiresAt && isPast(form.expiresAt)) {
      setExpiryErr(MSG.EXP_PAST);
      return;
    }
    if (form.code && !CODE_RE.test(form.code)) {
      setCodeErr(MSG.CODE_FMT);
      return;
    }
    if (form.domain && !HOST_RE.test(form.domain)) {
      setDomainErr(MSG.DOMAIN_FMT);
      return;
    }
    if (form.protect && (!form.linkPassword || form.linkPassword.length < 4)) {
      return setErr(MSG.PASS_REQ);
    }
    const parsedMax = parseNonNegativeInt(form.maxClicks);
    if (Number.isNaN(parsedMax)) {
      setMaxErr(MSG.MAX_NUM);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        longUrl: form.longUrl.trim(),
        code: form.code?.trim() || undefined,
        notes: form.notes?.trim() || "",
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        password: form.protect ? form.linkPassword : undefined,
        domain: form.domain ? form.domain.trim().toLowerCase() : undefined,
        maxClicks: parsedMax,
      };

      let data;
      if (isEdit) {
        const res = await api.patch(`/links/${linkData._id}`, payload);
        data = res?.data;
      } else {
        const res = await api.post("/links", payload);
        data = res?.data;
      }

      const base = getOriginForPreview(form.domain);
      const shortUrl = data?.shortUrl || `${base}/r/${data?.code || payload.code}`;

      const slugChanged = isEdit && linkData.code !== (payload.code || linkData.code);
      try {
        if (!isEdit || slugChanged) await navigator.clipboard.writeText(shortUrl);
      } catch {}

      const codeShown = data?.code || form.code;
      const msg = isEdit
        ? `Link "${codeShown}" updated${slugChanged ? " & copied!" : "!"}`
        : `Link "${codeShown}" created & copied!`;

      showToast(msg, "success");

      onCreated?.(data);
      onClose?.();
    } catch (e1) {
      setErr(
        e1?.response?.data?.message ||
          e1?.response?.data?.error ||
          e1?.message ||
          MSG.SAVE_FAIL
      );
    } finally {
      setLoading(false);
    }
  }

  const statusColor = STATUS_TO_CLASS[domainTest.status];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="dialog-panel relative w-screen h-screen sm:w-full sm:h-auto sm:max-w-lg sm:max-h-[85vh]
                   bg-[var(--surface)] rounded-none sm:rounded-2xl shadow-lg overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="max-h-full sm:max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-[var(--surface)] pb-2 z-10">
            <h2 className="text-lg font-semibold">
              {isEdit ? "Edit Short Link" : "Create Short Link"}
            </h2>
            <button
              type="button"
              onClick={() => !loading && onClose?.()}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="longUrl" className="block text-sm font-medium mb-1">
                Original URL
              </label>
              <input
                id="longUrl"
                name="longUrl"
                value={form.longUrl}
                onChange={onChange}
                placeholder="https://example.com/landing"
                required
                className="input"
                autoComplete="url"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-1">
                  Custom slug {isEdit ? "(you can rename)" : "(optional)"}
                </label>
                <input
                  id="code"
                  name="code"
                  value={form.code}
                  onChange={onChange}
                  placeholder="my-campaign"
                  className={`input ${
                    codeErr ? "!border-[var(--error)] focus:!border-[var(--error)]" : ""
                  }`}
                />
                {codeErr && <p className="mt-1 text-xs text-[var(--error)]">{codeErr}</p>}
              </div>

              <div className="relative">
                <label htmlFor="expiresAt" className="block text-sm font-medium mb-1">
                  Expiry (optional)
                </label>
                <input
                  id="expiresAt"
                  name="expiresAt"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={onChange}
                  min={minLocal}
                  step={60}
                  className="input pr-10"
                />
                {form.expiresAt && (
                  <button
                    type="button"
                    onClick={clearExpiry}
                    className="absolute right-2 bottom-2 h-7 w-7 grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                    title="Clear expiry"
                    aria-label="Clear expiry"
                  >
                    ×
                  </button>
                )}
                {expiryErr && <p className="mt-1 text-xs text-[var(--error)]">{expiryErr}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-end justify-between">
                  <label htmlFor="domain" className="block text-sm font-medium mb-1">
                    Custom domain (host only)
                  </label>
                  <button
                    type="button"
                    onClick={testDomain}
                    className="text-xs underline opacity-80 hover:opacity-100 disabled:opacity-50"
                    disabled={domainTest.status === "checking"}
                    aria-label="Test custom domain"
                  >
                    Test domain
                  </button>
                </div>
                <input
                  id="domain"
                  name="domain"
                  value={form.domain}
                  onChange={onChange}
                  placeholder="go.yoursite.com"
                  className={`input ${
                    domainErr ? "!border-[var(--error)] focus:!border-[var(--error)]" : ""
                  }`}
                />
                {domainErr && <p className="mt-1 text-xs text-[var(--error)]">{domainErr}</p>}
                {domainTest.status !== "idle" && (
                  <p className={`mt-1 text-xs ${statusColor}`}>{domainTest.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="maxClicks" className="block text-sm font-medium mb-1">
                  Max clicks (0 = unlimited)
                </label>
                <input
                  id="maxClicks"
                  name="maxClicks"
                  type="number"
                  min={0}
                  value={form.maxClicks}
                  onChange={onChange}
                  className={`input ${maxErr ? "!border-[var(--error)] focus:!border-[var(--error)]" : ""}`}
                />
                {maxErr && <p className="mt-1 text-xs text-[var(--error)]">{maxErr}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={form.notes}
                onChange={onChange}
                className="textarea"
                placeholder="Internal label to identify this link"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="protect"
                name="protect"
                type="checkbox"
                checked={form.protect}
                onChange={onChange}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <label htmlFor="protect" className="text-sm">
                Protect this link with a password
              </label>
            </div>

            {form.protect && (
              <PasswordInput
                name="linkPassword"
                value={form.linkPassword}
                onChange={onChange}
                label="Link password"
                placeholder="Set a password for this link"
                required
                autoComplete="new-password"
                helperText="Visitors must enter this password before redirect."
              />
            )}

            {err && <p className="text-sm text-[var(--error)]">{err}</p>}

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-muted truncate" aria-live="polite">
                Preview: <span className="font-medium">{shortPreview}</span>
              </div>
              <button
                type="submit"
                disabled={loading || !!expiryErr || !!domainErr || !!codeErr || !!maxErr}
                className="btn-primary disabled:opacity-60"
                aria-label={isEdit ? "Save changes" : "Create link and copy"}
              >
                {loading ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Update Link" : "Create & Copy"}
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickPick label="+1h" addMs={DUR.H1} setForm={setForm} />
            <QuickPick label="+1d" addMs={DUR.D1} setForm={setForm} />
            <QuickPick label="+7d" addMs={DUR.D7} setForm={setForm} />
            <QuickPick label="+30d" addMs={DUR.D30} setForm={setForm} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * QuickPick — small expiry shortcuts
 * @param {{ label:string, addMs:number, setForm:Function }} props
 */
function QuickPick({ label, addMs, setForm }) {
  const set = () => {
    const base = nowRoundedToMinute();
    const next = new Date(base.getTime() + addMs);
    setForm((f) => ({ ...f, expiresAt: toLocalDatetimeInputValue(next) }));
  };
  return (
    <button
      type="button"
      onClick={set}
      className="px-2.5 py-1 text-xs rounded-full border hover:bg-black/5 dark:hover:bg-white/10"
      title={`Set expiry ${label} from now`}
      aria-label={`Set expiry ${label} from now`}
    >
      {label}
    </button>
  );
}
