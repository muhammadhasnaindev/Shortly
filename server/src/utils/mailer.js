/**
 * utils/mailer.js
 * Short: SMTP/dev mailer transport + simple code email template.

 */

import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/* ================================================================== */
/* State                                                               */
/* ================================================================== */
let transporter;
let mode = "smtp"; // "smtp" | "dev"

/* ================================================================== */
/* Builders                                                            */
/* ================================================================== */
function buildSMTP() {
  // Prefer SSL on 465 – fewer firewall issues than STARTTLS 587
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,            // 465 by default from env
    secure: env.SMTP_PORT === 465,  // true for 465, false for 587
    requireTLS: env.SMTP_PORT === 587, // if you force 587
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    tls: { minVersion: "TLSv1.2" },
  });
}

function buildDev() {
  // Doesn’t send. Buffers the message so we can log it.
  return nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
}

function initTransport() {
  if (env.DEV_MAIL) {
    mode = "dev";
    return buildDev();
  }
  // If any required SMTP variable is missing, use dev mode.
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    mode = "dev";
    return buildDev();
  }
  mode = "smtp";
  return buildSMTP();
}

transporter = initTransport();

/* ================================================================== */
/* API                                                                 */
/* ================================================================== */
/**
 * Send an email via SMTP if configured, else dev transport logs payload.
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
export async function sendMail(to, subject, text, html) {
  const from = env.SMTP_FROM || env.SMTP_USER || "no-reply@example.com";

  if (mode === "smtp") {
    try {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      return info;
    } catch (e) {
      // Fallback to dev transport to avoid crashing the app
      console.error("[MAIL] SMTP failed:", e?.message || e);
      mode = "dev";
      transporter = buildDev();
      const info = await transporter.sendMail({ from, to, subject, text, html });
      console.log("----- DEV MAIL (SMTP failed) -----\n" + info.message.toString());
      return info;
    }
  }

  // Dev transport: just log
  const info = await transporter.sendMail({ from, to, subject, text, html });
  console.log("----- DEV MAIL -----\n" + info.message.toString());
  return info;
}

/**
 * Build a simple verification/reset code email (text + HTML).
 * @param {{ title: string, code: string, hint?: string }} param0
 */
export function codeEmailTemplate({ title, code, hint }) {
  const text = `${title}

Your code is: ${code}

This code expires in 10 minutes. ${hint || ""}

If you didn’t request this, ignore this email.`;

  const html = `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
    <h2>${title}</h2>
    <p>Your code is:</p>
    <div style="font-size:28px;font-weight:700;letter-spacing:4px;padding:12px 16px;border:1px solid #eee;border-radius:10px;display:inline-block;">
      ${code}
    </div>
    <p style="margin-top:12px;color:#555">This code expires in <b>10 minutes</b>. ${hint || ""}</p>
    <p style="color:#777">If you didn’t request this, ignore this email.</p>
  </div>`;
  return { text, html };
}
