import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Anonymous assumption consensus.
 *
 * Stores nothing but a handful of numbers per submitted model — no account, no IP,
 * no identifier of any kind. The point is to answer the question a beginner can't
 * answer alone: "is my assumption reasonable, or wildly out of line?"
 *
 * Degrades silently: with no Redis configured, GET returns n=0 and the UI hides itself.
 */
const VALID_SYMBOL = /^[A-Z0-9.\-]{1,10}$/;
const CAP = 500;                 // keep the most recent N submissions per ticker
const TTL = 60 * 60 * 24 * 365;  // a year

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try { redis = Redis.fromEnv(); } catch { redis = null; }
}

const key = (s) => `vexa:cons:${s}`;
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

function stats(values) {
  const v = values.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (p) => v[Math.min(v.length - 1, Math.max(0, Math.floor((v.length - 1) * p)))];
  return { median: at(0.5), p25: at(0.25), p75: at(0.75), min: v[0], max: v[v.length - 1], n: v.length };
}

async function readAll(symbol) {
  if (!redis) return [];
  const raw = await redis.lrange(key(symbol), 0, CAP - 1);
  return (raw || []).map((r) => {
    try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; }
  }).filter(Boolean);
}

export async function GET(req, { params }) {
  const symbol = decodeURIComponent(params.symbol || "").toUpperCase().trim();
  if (!VALID_SYMBOL.test(symbol)) return NextResponse.json({ n: 0 });
  try {
    const rows = await readAll(symbol);
    if (rows.length === 0) return NextResponse.json({ n: 0 });
    return NextResponse.json({
      n: rows.length,
      growth: stats(rows.map((r) => r.g)),
      gm: stats(rows.map((r) => r.m)),
      tg: stats(rows.map((r) => r.t)),
      beta: stats(rows.map((r) => r.b)),
    });
  } catch {
    return NextResponse.json({ n: 0 });   // never let this break the model page
  }
}

export async function POST(req, { params }) {
  const symbol = decodeURIComponent(params.symbol || "").toUpperCase().trim();
  if (!VALID_SYMBOL.test(symbol)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await checkRateLimit(`cons:${clientIp(req)}`, { limit: 10, windowMs: 60_000 })).ok)
    return NextResponse.json({ ok: false }, { status: 429 });
  if (!redis) return NextResponse.json({ ok: true, stored: false });

  try {
    const b = await req.json();
    // clamp to plausible ranges so one bad actor can't skew the medians
    const row = {
      g: num(b.growth, -0.5, 1.0),
      m: num(b.gm, 0, 0.99),
      t: num(b.tg, -0.02, 0.06),
      b: num(b.beta, 0.1, 4),
    };
    if (row.g === null && row.m === null && row.t === null && row.b === null)
      return NextResponse.json({ ok: false }, { status: 400 });

    await redis.lpush(key(symbol), JSON.stringify(row));
    await redis.ltrim(key(symbol), 0, CAP - 1);
    await redis.expire(key(symbol), TTL);
    return NextResponse.json({ ok: true, stored: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
