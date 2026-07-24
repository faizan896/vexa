import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";

const BASE = "https://financialmodelingprep.com/stable";
// only these load on the free plan — filter out foreign micro-caps that would error on click
const US = new Set(["NASDAQ", "NYSE", "AMEX", "NYSE AMERICAN"]);
const isUS = (r) => {
  const e = (r.exchange || r.exchangeShortName || r.exchangeFullName || "").toUpperCase();
  return US.has(e) || /NASDAQ|NEW YORK STOCK|NYSE|AMERICAN STOCK/.test(e);
};
// drop leveraged/inverse ETFs & obvious non-operating tickers by name
const junk = (r) => /(\d[xX]|leveraged|inverse|bull |bear |etf|etn)/i.test(r.name || "");
// preferred-share series (e.g. JPM-PC, BAC-PL) clutter results — keep class shares like BRK-B
const pref = (r) => /-P[A-Z]?$/.test(r.symbol || "");

export async function GET(req) {
  if (!(await checkRateLimit(`search:${clientIp(req)}`, { limit: 25, windowMs: 10_000 })).ok)
    return NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
  // cap length & strip anything not plausibly part of a ticker/company name
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 32).replace(/[^\w .&-]/g, "");
  if (!q) return NextResponse.json([]);
  const key = process.env.FMP_API_KEY;
  if (!key) return NextResponse.json({ error: "Server missing FMP_API_KEY" }, { status: 500 });
  try {
    const [bySym, byName] = await Promise.all([
      fetch(`${BASE}/search-symbol?query=${encodeURIComponent(q)}&limit=20&apikey=${key}`, { next: { revalidate: 86400 } }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${BASE}/search-name?query=${encodeURIComponent(q)}&limit=20&apikey=${key}`, { next: { revalidate: 86400 } }).then((r) => (r.ok ? r.json() : [])),
    ]);
    const seen = new Set();
    const all = [...(Array.isArray(bySym) ? bySym : []), ...(Array.isArray(byName) ? byName : [])].filter((r) => {
      if (!r.symbol || seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });
    // US-listed first (these actually work); exact ticker match floated to top
    const ql = q.toLowerCase();
    const keep = (r) => !junk(r) && (!pref(r) || r.symbol.toLowerCase() === ql);
    const us = all.filter((r) => isUS(r) && keep(r));
    const list = (us.length ? us : all.filter(keep))
      .sort((a, b) => (b.symbol.toLowerCase() === ql ? 1 : 0) - (a.symbol.toLowerCase() === ql ? 1 : 0))
      .slice(0, 8);
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Search failed — try again." }, { status: 502 });
  }
}
