/**
 * User.js
 * Short: Application user with auth + verification state.

 */

import mongoose from "mongoose";

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Provide persistent identity for links + dashboards.
   Context: Email uniqueness + indexing improves lookups.
   Edge cases: Verification + reset codes expire via cron/TTL outside.   */
/* ------------------------------------------------------------------ */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: { type: String, required: true },

    // Email verification
    emailVerified: { type: Boolean, default: false, index: true },
    verifyCode: { type: String, default: null },
    verifyCodeExpires: { type: Date, default: null },

    // Password reset
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },

    // Role-based access
    role: { type: String, enum: ["user", "admin"], default: "user", index: true }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
