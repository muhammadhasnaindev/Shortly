/**
 * Click.js
 * Short: Stores individual visit events for short links.

 */

import mongoose from "mongoose";

/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Track each visit for analytics (timeline, geography).
   Context: Keeping `ts` explicit avoids auto-updates from timestamps:true.
   Edge cases: High click volume → keep indexes tight (linkId, ts).    */
/* ------------------------------------------------------------------ */
const clickSchema = new mongoose.Schema(
  {
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: "Link", index: true },
    ts: { type: Date, default: () => new Date(), index: true },
    referer: { type: String, default: "direct" },
    country: { type: String },
    ua: { type: String },
    device: { type: String },
    browser: { type: String },
    ipHash: { type: String },
    tzOffset: { type: Number },
    utm: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String }
    }
  },
  { timestamps: false }
);

// Sort latest-first when querying a link’s visits.
clickSchema.index({ linkId: 1, ts: -1 });

export default mongoose.model("Click", clickSchema);
