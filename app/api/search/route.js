import { NextResponse } from "next/server";

const BASE = "https://financialmodelingprep.com/stable";
// only these load on the free plan — filter out foreign micro-caps that would error on click
const US = new Set(["NASDAQ", "NYSE", "AMEX", "NYSE AMERICAN", "NYSEARCA", "CBOE", "OTC"]);
const isUS = (r) => {
  const e = (r.exchange || r.exchangeShortName || r.exchangeFullName || "").toUpperCase();
  return US.has(e) || /NASDAQ|NEW YORK|NYSE|AMERICAN/.test(e);
};

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);
  const key = process.env.FMP_API_KEY;
  if (!key) return NextResponse.json({ error: "Server missing FMP_API_KEY" }, { status: 500 });
  try {
    const [bySym, byName] = await Promise.all([
      fetch(`${BASE}/search-symbol?query=${encodeURIComponent(q)}&limit=20&apikey=${key}`, { next: { revalidate: 3600 } }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${BASE}/search-name?query=${encodeURIComponent(q)}&limit=20&apikey=${key}`, { next: { revalidate: 3600 } }).then((r) => (r.ok ? r.json() : [])),
    ]);
    const seen = new Set();
    const all = [...(Array.isArray(bySym) ? bySym : []), ...(Array.isArray(byName) ? byName : [])].filter((r) => {
      if (!r.symbol || seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });
    // US-listed first (these actually work); exact ticker match floated to top
    const ql = q.toLowerCase();
    const us = all.filter(isUS);
    const list = (us.length ? us : all)
      .sort((a, b) => (b.symbol.toLowerCase() === ql ? 1 : 0) - (a.symbol.toLowerCase() === ql ? 1 : 0))
      .slice(0, 8);
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Search failed — try again." }, { status: 502 });
  }
}
