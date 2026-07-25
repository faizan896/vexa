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

/**
 * Household names people actually type, mapped to the parent company. Without this,
 * name search surfaces bottlers/subsidiaries above the parent (e.g. "coca-cola"
 * returned COKE/KOF/CCEP but never KO).
 */
const ALIASES = {
  "coca cola": "KO", "cocacola": "KO", "coke": "KO",
  google: "GOOGL", alphabet: "GOOGL",
  facebook: "META", meta: "META", instagram: "META",
  apple: "AAPL", microsoft: "MSFT", amazon: "AMZN", tesla: "TSLA",
  nvidia: "NVDA", netflix: "NFLX", disney: "DIS", nike: "NKE",
  starbucks: "SBUX", mcdonalds: "MCD", walmart: "WMT", costco: "COST",
  pepsi: "PEP", pepsico: "PEP", visa: "V", mastercard: "MA",
  intel: "INTC", amd: "AMD", adobe: "ADBE", salesforce: "CRM",
  oracle: "ORCL", ibm: "IBM", cisco: "CSCO", qualcomm: "QCOM",
  boeing: "BA", "goldman sachs": "GS", goldman: "GS",
  "jp morgan": "JPM", jpmorgan: "JPM", "bank of america": "BAC",
  toyota: "TM", sony: "SONY", alibaba: "BABA", uber: "UBER",
  airbnb: "ABNB", spotify: "SPOT", paypal: "PYPL", shopify: "SHOP",
  "berkshire hathaway": "BRK-B", berkshire: "BRK-B",
  "johnson & johnson": "JNJ", pfizer: "PFE", "exxon": "XOM",
};

// strip punctuation and corporate suffixes so "The Coca-Cola Company" ≈ "coca cola"
const SUFFIX = /\b(the|inc|incorporated|corp|corporation|company|co|plc|ltd|limited|holdings?|group|sa|nv|ag|class [a-c])\b/g;
const norm = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();

function score(r, ql, nq, aliasTicker) {
  const sym = (r.symbol || "").toLowerCase();
  const nName = norm(r.name);
  let s = 0;
  if (sym === ql) s += 1000;                        // exact ticker wins outright
  if (aliasTicker && r.symbol === aliasTicker) s += 900; // known parent company
  if (nName && nName === nq) s += 800;              // exact name after normalisation
  else if (nName.startsWith(nq)) s += 400;
  else if (nName.includes(nq)) s += 150;
  // prefer the shorter, parent-sounding name ("Coca-Cola" over "Coca-Cola Consolidated")
  s -= Math.min(nName.length, 60) * 0.5;
  return s;
}

export async function GET(req) {
  if (!(await checkRateLimit(`search:${clientIp(req)}`, { limit: 25, windowMs: 10_000 })).ok)
    return NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
  // cap length & strip anything not plausibly part of a ticker/company name
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 32).replace(/[^\w .&-]/g, "");
  if (!q) return NextResponse.json([]);
  const key = process.env.FMP_API_KEY;
  if (!key) return NextResponse.json({ error: "Server missing FMP_API_KEY" }, { status: 500 });

  const ql = q.toLowerCase();
  const nq = norm(q);
  const aliasTicker = ALIASES[nq] || ALIASES[ql] || null;

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

    const keep = (r) => !junk(r) && (!pref(r) || r.symbol.toLowerCase() === ql);
    const us = all.filter((r) => isUS(r) && keep(r));
    let list = us.length ? us : all.filter(keep);

    // if we know the parent company for this query but it isn't in the results, fetch it
    if (aliasTicker && !list.some((r) => r.symbol === aliasTicker)) {
      try {
        const p = await fetch(`${BASE}/profile?symbol=${aliasTicker}&apikey=${key}`, { next: { revalidate: 86400 } });
        if (p.ok) {
          const j = await p.json();
          const prof = Array.isArray(j) ? j[0] : j;
          if (prof?.symbol) list.unshift({ symbol: prof.symbol, name: prof.companyName, exchange: prof.exchange || prof.exchangeFullName });
        }
      } catch { /* ranking still applies without it */ }
    }

    list = list
      .map((r) => ({ r, s: score(r, ql, nq, aliasTicker) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r)
      .slice(0, 8);

    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: "Search failed — try again." }, { status: 502 });
  }
}
