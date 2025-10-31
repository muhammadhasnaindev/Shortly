/**
 * Link.js
 * Short: Core short-link entity containing ownership, code, and metadata.

 */

import mongoose from "mongoose";

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Represent a short link owned by a user.
   Context: Clicks relate to Link via linkId; keep code indexed + unique.
   Edge cases: `maxClicks=0` → unlimited usage; expiration optional.     */
/* ------------------------------------------------------------------ */
const linkSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    code: { type: String, required: true, unique: true, index: true },
    longUrl: { type: String, required: true },
    domain: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },

    passwordHash: { type: String, default: null },

    maxClicks: { type: Number, default: 0 },
    clicksCount: { type: Number, default: 0 },

    meta: {
      title: { type: String },
      favicon: { type: String },
      notes: { type: String, maxlength: 1000 }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Link", linkSchema);
