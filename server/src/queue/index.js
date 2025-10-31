/**
 * queue/index.js
 * Short: Optional BullMQ pipeline for click logging with safe, inline fallback.
 
 */

import { env } from "../config/env.js";
import Click from "../models/Click.js";
import Link from "../models/Link.js";

/* ================================================================== */
/* Constants (avoid magic numbers)                                     */
/* ================================================================== */
const QUEUE_NAME = "clicks";
const JOB_NAME = "log";
const REMOVE_ON_COMPLETE = 500;
const REMOVE_ON_FAIL = 200;

let useQueue = false;
let Queue, Worker, queue;

// Only log the first connection failure to avoid noisy console
let warnedOnce = false;
function logWarnOnce(msg) {
  if (!warnedOnce) {
    console.warn(msg);
    warnedOnce = true;
  }
}

/* ================================================================== */
/* [PRO] Purpose: Initialize BullMQ if Redis is available; else degrade.
   Context: Not all environments provision Redis (local/dev/preview).
   Edge cases: Dynamic import failures, transient Redis outages.
   Notes: Fallback path runs inline work on nextTick.                   */
/* ================================================================== */
export async function initQueue() {
  const url = env.REDIS_URL?.trim();
  if (!url) {
    useQueue = false;
    console.log("Queue disabled: REDIS_URL not set");
    return;
  }

  try {
    const mod = await import("bullmq");
    Queue = mod.Queue;
    Worker = mod.Worker;

    queue = new Queue(QUEUE_NAME, { connection: { url } });

    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const { payload } = job.data || {};
        if (!payload) return;
        await Click.create(payload);
        await Link.updateOne({ _id: payload.linkId }, { $inc: { clicksCount: 1 } });
      },
      { connection: { url } }
    );

    worker.on("error", (err) => {
      logWarnOnce(`BullMQ worker error (${err?.code || err?.name || "ERR"}) → using inline fallback`);
      useQueue = false;
    });

    queue.on("error", (err) => {
      logWarnOnce(`BullMQ queue error (${err?.code || err?.name || "ERR"}) → using inline fallback`);
      useQueue = false;
    });

    useQueue = true;
    console.log("Queue enabled: Redis connection established");
  } catch (err) {
    logWarnOnce(`Redis/BullMQ unavailable (${err?.code || err?.message || err}) → using inline fallback`);
    useQueue = false;
  }
}

/**
 * Enqueue a click job; fallback performs the write inline on next tick.
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function enqueueClick(payload) {
  if (useQueue && queue) {
    try {
      await queue.add(JOB_NAME, { payload }, { removeOnComplete: REMOVE_ON_COMPLETE, removeOnFail: REMOVE_ON_FAIL });
      return;
    } catch (err) {
      logWarnOnce(`Failed to enqueue (${err?.code || err?.message || "ERR"}) → using inline fallback`);
    }
  }

  // Fallback: do the work without Redis
  process.nextTick(async () => {
    try {
      await Click.create(payload);
      await Link.updateOne({ _id: payload.linkId }, { $inc: { clicksCount: 1 } });
    } catch {
      // silent by design; do not spam logs on hot paths
    }
  });
}
