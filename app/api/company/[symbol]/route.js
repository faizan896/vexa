import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";

const BASE = "https://financialmodelingprep.com/stable";
// tickers are short and alphanumeric (plus . and - for class/preferred shares)
const VALID_SYMBOL = /^[A-Z0-9.\-]{1,10}$/;
// last-good in-memory cache so a transient upstream outage degrades gracefully
// (serve the previous good payload marked stale) instead of a dead screen.
const LAST_GOOD = new Map();

export async function GET(req, { params }) {
  if (!(await checkRateLimit(`company:${clientIp(req)}`, { limit: 30, windowMs: 10_000 })).ok)
    return NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
  const symbol = decodeURIComponent(params.symbol || "").toUpperCase().trim();
  if (!VALID_SYMBOL.test(symbol))
    return NextResponse.json({ error: "That doesn't look like a valid ticker." }, { status: 400 });
  const key = process.env.FMP_API_KEY;
  if (!key) return NextResponse.json({ error: "Server missing FMP_API_KEY" }, { status: 500 });

  // Cache aggressively to conserve the FMP quota: financial statements change only
  // a few times a year, so cache them 24h; the profile (which carries the price) 1h.
  const get = async (path, revalidate = 86400) => {
    const r = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}apikey=${key}`, { next: { revalidate } });
    if (r.status === 402 || r.status === 403) throw { code: "PLAN" };
    if (r.status === 429 || r.status >= 500) throw { code: "UPSTREAM", status: r.status }; // rate-limit / outage on the data provider
    if (!r.ok) throw { code: "HTTP", status: r.status };
    return r.json();
  };

  try {
    const [profileArr, income, balance, cashflow] = await Promise.all([
      get(`profile?symbol=${symbol}`, 3600), // price — keep ~1h fresh
      get(`income-statement?symbol=${symbol}&limit=3`),
      get(`balance-sheet-statement?symbol=${symbol}&limit=3`),
      get(`cash-flow-statement?symbol=${symbol}&limit=3`),
    ]);
    const profile = Array.isArray(profileArr) ? profileArr[0] : profileArr;
    if (!profile || !Array.isArray(income) || income.length === 0 ||
        !Array.isArray(balance) || balance.length === 0 || !Array.isArray(cashflow) || cashflow.length === 0) {
      return NextResponse.json(
        { error: "No financial data available for this company on the current data plan. Try a US-listed ticker — most global giants have a US listing or ADR (e.g. TM for Toyota, BABA for Alibaba)." },
        { status: 404 }
      );
    }
    // API returns newest-first; engine expects oldest-first
    const asc = (a) => [...a].reverse();
    const data = { profile, income: asc(income), balance: asc(balance), cashflow: asc(cashflow) };
    LAST_GOOD.set(symbol, data);
    if (LAST_GOOD.size > 500) LAST_GOOD.delete(LAST_GOOD.keys().next().value);
    return NextResponse.json(data);
  } catch (e) {
    // graceful degradation: if we served this ticker before, return the stale copy
    const cached = LAST_GOOD.get(symbol);
    if (cached && e?.code !== "PLAN") return NextResponse.json({ ...cached, stale: true });

    if (e?.code === "PLAN")
      return NextResponse.json(
        { error: "This ticker isn't covered by the free data plan (usually non-US listings). Try the company's US ticker or ADR instead — e.g. TM for Toyota, SONY for Sony, SAP for SAP." },
        { status: 402 }
      );
    if (e?.code === "UPSTREAM")
      return NextResponse.json(
        { error: "Market data is temporarily unavailable — this is on the data provider's side, not the ticker. Please try again in a moment.", upstream: true },
        { status: 503 }
      );
    return NextResponse.json({ error: "We couldn't load that company. Please retry, or check the ticker." }, { status: 502 });
  }
}
