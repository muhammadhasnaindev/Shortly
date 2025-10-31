/**
 * Settings — custom domain docs + live domain route checker
 *
 * Summary:
 * - Explains how to point a domain to backend /r/*.
 * - Provides a simple tool to probe PNG and JSON endpoints to validate routing.
 */

import Topbar from "../components/Topbar";
import MobileNav from "../components/MobileNav";
import { useState } from "react";
import { TextField, Alert, Button, CircularProgress } from "@mui/material";

/* ---------------------------------------------
   Constants
---------------------------------------------- */
const HOST_RE = /^[a-z0-9.-]+$/i;

function DomainCheck() {
  const [domain, setDomain] = useState("go.yoursite.com");
  const [status, setStatus] = useState(null); // null | 'ok' | 'fail' | 'checking'
  const [details, setDetails] = useState("");

  /* ---------------------------------------------
     [PRO] Purpose:
     PNG probe avoids CORS; JSON probe adds extra signal.

     Context:
     Matches CreateLinkModal behavior; CORS failure is acceptable.

     Edge cases:
     Invalid host short-circuits with a clear message.
  ---------------------------------------------- */
  const checkViaImage = () =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = `https://${domain}/r/_health.png?ts=${Date.now()}`;
    });

  const checkViaFetch = async () => {
    try {
      const res = await fetch(`https://${domain}/r/_health`, { mode: "cors" });
      return res.ok;
    } catch {
      return false;
    }
  };

  const run = async () => {
    if (!domain || !HOST_RE.test(domain)) {
      setStatus("fail");
      setDetails("Enter a valid host like go.example.com");
      return;
    }
    setStatus("checking");
    setDetails("Checking route /r/_health.png ...");
    try {
      await checkViaImage();
      setDetails("Image probe ok. Verifying JSON probe ...");
      const ok = await checkViaFetch();
      if (ok) {
        setStatus("ok");
        setDetails("This domain routes /r/* to your backend. You can use it in Custom Domain.");
      } else {
        setStatus("ok");
        setDetails("Image probe succeeded (good). JSON probe blocked by CORS (acceptable).");
      }
    } catch {
      setStatus("fail");
      setDetails(
        `Could not load https://${domain}/r/_health.png — DNS/proxy not pointing to backend.`
      );
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="text-lg font-semibold">Custom Domain Checker</div>
      <p className="text-sm text-muted">
        Enter the domain you plan to use for short links. We’ll test whether <code>/r/*</code> is
        reaching your backend.
      </p>
      <div className="flex flex-col md:flex-row gap-2">
        <TextField
          label="Domain (host only)"
          placeholder="go.hasnain.com"
          fullWidth
          value={domain}
          onChange={(e) => setDomain(e.target.value.trim())}
          inputProps={{ "aria-label": "Custom domain host" }}
        />
        <Button variant="contained" onClick={run} disabled={status === "checking"} aria-label="Check domain routing">
          {status === "checking" ? (
            <>
              <CircularProgress size={18} sx={{ mr: 1 }} /> Checking…
            </>
          ) : (
            "Check"
          )}
        </Button>
      </div>

      {status === "ok" && <Alert severity="success">{details}</Alert>}
      {status === "fail" && <Alert severity="error">{details}</Alert>}
      {status === "checking" && <Alert severity="info">{details}</Alert>}

      <div className="text-xs text-muted">
        We load <code>https://&lt;domain&gt;/r/_health.png</code>. If it loads, your domain is correctly
        proxied (e.g., with Nginx/Cloudflare) to the API.
      </div>
    </div>
  );
}

export default function Settings() {
  const [example, setExample] = useState("go.hasnain.com");

  return (
    <div className="min-h-screen">
      <Topbar />
      <div className="page p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <div className="card p-5 space-y-3">
          <div className="text-lg font-semibold">Custom Domain</div>
          <p className="text-sm text-muted">
            Point your domain/subdomain to your backend (proxy only <code>/r/*</code> is enough). Then
            use it in Create Link as <b>Custom Domain</b>.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted">
            <li>
              DNS: <b>CNAME</b> <code>go</code> → your API host (or A record to server IP).
            </li>
            <li>HTTPS: issue certificate (Cloudflare / Let’s Encrypt).</li>
            <li>
              Proxy rule (example Nginx):{" "}
              <code>location /r/ {'{'} proxy_pass http://127.0.0.1:5000/r/; {'}'}</code>
            </li>
          </ol>
          <TextField
            label="Example domain"
            value={example}
            onChange={(e) => setExample(e.target.value)}
            inputProps={{ "aria-label": "Example domain" }}
          />
          <Alert severity="info">
            The short URL will format as <code>https://{example}/r/&lt;code&gt;</code>. No extra
            server config needed beyond routing.
          </Alert>
        </div>

        <DomainCheck />
      </div>
      <MobileNav />
    </div>
  );
}
