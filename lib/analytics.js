"use client";
import { track as vercelTrack } from "@vercel/analytics";

/**
 * Thin wrapper so tracking can never break the app: if analytics is blocked,
 * unavailable, or errors, the call is a no-op.
 */
export function track(event, props) {
  try { vercelTrack(event, props); } catch { /* never let analytics break the product */ }
}

const FIRST = "vexa_first_seen";
const COUNT = "vexa_visit_count";
const SESSION = "vexa_session_logged";

/**
 * Retention signal. Vercel's dashboard shows visitors, but not whether the SAME
 * person came back — which is the number that actually matters right now.
 * We keep a first-seen date locally and report new vs returning once per session.
 */
export function trackVisit() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(SESSION)) return;   // once per session
    sessionStorage.setItem(SESSION, "1");

    const now = Date.now();
    const first = localStorage.getItem(FIRST);
    const count = Number(localStorage.getItem(COUNT) || 0) + 1;
    localStorage.setItem(COUNT, String(count));

    if (!first) {
      localStorage.setItem(FIRST, String(now));
      track("visitor", { type: "new", visit: 1 });
      return;
    }
    const days = Math.floor((now - Number(first)) / 86400000);
    track("visitor", {
      type: "returning",
      visit: count,
      // bucketed so the dashboard stays readable
      since: days === 0 ? "same-day" : days === 1 ? "next-day" : days <= 7 ? "2-7d" : days <= 30 ? "8-30d" : "30d+",
    });
  } catch { /* private mode / storage disabled */ }
}
