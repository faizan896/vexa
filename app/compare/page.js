"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { deriveState, runModel } from "@/lib/engine";
import { pc, px, mx, big, curSym } from "@/lib/format";

function Search({ side, onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const t = useRef(null);
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) return setRes([]);
    t.current = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`); const j = await r.json(); setRes(Array.isArray(j) ? j : []); } catch { setRes([]); }
    }, 350);
    return () => clearTimeout(t.current);
  }, [q]);
  return (
    <div className="cmp-search">
      <div className="smallcaps">{side}</div>
      <div className="searchbox">
        <input placeholder="Search a company…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (res[0] || q.trim())) { onPick((res[0]?.symbol || q.trim().toUpperCase())); setQ(""); setRes([]); } }} />
        {res.length > 0 && (
          <div className="search-results">
            {res.map((r) => (
              <button key={r.symbol} onClick={() => { onPick(r.symbol); setQ(""); setRes([]); }}>
                <span><span className="sym">{r.symbol}</span> &nbsp;{r.name}</span>
                <span className="exch">{r.exchange || r.exchangeFullName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Compare() {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState("");

  const load = async (sym, setter) => {
    setLoading(sym);
    try {
      const r = await fetch(`/api/company/${encodeURIComponent(sym)}`);
      const j = await r.json();
      if (!r.ok) { setter({ error: j.error || "Could not load.", sym }); return; }
      const st = deriveState(j);
      setter({ sym, state: st, base: runModel(st, 0) });
    } catch { setter({ error: "Network error.", sym }); }
    finally { setLoading(""); }
  };

  const metric = (label, fa, fb, hi) => {
    const va = a && !a.error ? fa(a) : "—";
    const vb = b && !b.error ? fb(b) : "—";
    return (
      <tr className={hi ? "bold" : ""}>
        <td>{label}</td>
        <td>{va}</td>
        <td>{vb}</td>
      </tr>
    );
  };
  const cA = a && !a.error ? curSym(a.state.hist.currency) : "$";
  const cB = b && !b.error ? curSym(b.state.hist.currency) : "$";
  const gm = (x) => 1 - x.state.hist.cogs[x.state.hist.cogs.length - 1] / x.state.hist.rev[x.state.hist.rev.length - 1];
  const ebitdaMargin = (x) => { const L = x.state.hist.rev.length - 1; const h = x.state.hist; return (h.rev[L] - h.cogs[L] - h.sga[L] + h.da[L]) / h.rev[L]; };
  const evEbitda = (x) => { const L = x.state.hist.rev.length - 1; const h = x.state.hist; const eb = h.rev[L] - h.cogs[L] - h.sga[L] + h.da[L]; return eb > 0 ? (h.shares[L] * h.price + h.debt[L] - h.cash[L]) / eb : 0; };
  const histG = (x) => { const h = x.state.hist; const L = h.rev.length - 1; return L >= 1 && h.rev[0] > 0 ? Math.pow(h.rev[L] / h.rev[0], 1 / L) - 1 : 0; };
  // same guard as the model page — a DCF is meaningless for banks/insurers and loss-makers
  const bad = (x) => { const d = x.base.dcf; return !(d.ev > 0 && d.perShare > 0 && d.wacc > 0) || /bank|insurance/i.test(x.state.co?.industry || ""); };

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/" className="logo-wrap"><Logo size={28} /><span className="logo">VE<span style={{ color: "var(--gold)" }}>XA</span></span></Link>
          <nav className="site-nav"><Link href="/">New model</Link><ThemeToggle /></nav>
        </div>
      </header>

      <main className="cmp-wrap">
        <h1 className="serif cmp-title">Compare two companies</h1>
        <p className="cmp-sub">Pick any two listed companies and see their valuations side by side — same model, same assumptions, run on each.</p>
        <div className="cmp-pickers">
          <Search side="Company A" onPick={(s) => load(s, setA)} />
          <div className="cmp-vs">vs</div>
          <Search side="Company B" onPick={(s) => load(s, setB)} />
        </div>
        {loading && <div className="cmp-loading">Loading {loading}…</div>}

        {(a || b) && (
          <div className="card" style={{ marginTop: 22 }}>
            <table className="fin">
              <thead>
                <tr>
                  <th></th>
                  <th>{a ? (a.error ? a.sym : a.state.hist.name) : "Company A"}</th>
                  <th>{b ? (b.error ? b.sym : b.state.hist.name) : "Company B"}</th>
                </tr>
              </thead>
              <tbody>
                {(a?.error || b?.error) && (
                  <tr><td>Note</td><td>{a?.error || ""}</td><td>{b?.error || ""}</td></tr>
                )}
                <tr className="section"><td colSpan={3}>Market</td></tr>
                {metric("Ticker", (x) => x.sym, (x) => x.sym)}
                {metric("Sector", (x) => x.state.co?.sector || "—", (x) => x.state.co?.sector || "—")}
                {metric("Share price", (x) => px(x.state.hist.price, cA), (x) => px(x.state.hist.price, cB))}
                {metric("Market cap", (x) => cA + big(x.state.co?.marketCap || x.state.hist.shares[x.state.hist.shares.length - 1] * x.state.hist.price), (x) => cB + big(x.state.co?.marketCap || x.state.hist.shares[x.state.hist.shares.length - 1] * x.state.hist.price))}
                <tr className="section"><td colSpan={3}>Business quality</td></tr>
                {metric("Revenue growth (3-yr)", (x) => pc(histG(x)), (x) => pc(histG(x)))}
                {metric("Gross margin", (x) => pc(gm(x)), (x) => pc(gm(x)))}
                {metric("EBITDA margin", (x) => pc(ebitdaMargin(x)), (x) => pc(ebitdaMargin(x)))}
                {metric("EV / EBITDA", (x) => mx(evEbitda(x)), (x) => mx(evEbitda(x)))}
                <tr className="section"><td colSpan={3}>Vexa valuation (Base case)</td></tr>
                {metric("WACC", (x) => bad(x) ? "n/m" : pc(x.base.dcf.wacc, 1), (x) => bad(x) ? "n/m" : pc(x.base.dcf.wacc, 1))}
                {metric("DCF value / share", (x) => bad(x) ? "n/m" : px(x.base.dcf.perShare, cA), (x) => bad(x) ? "n/m" : px(x.base.dcf.perShare, cB), true)}
                {metric("Upside / (downside)", (x) => bad(x) ? "n/m" : <span className={x.base.dcf.upside >= 0 ? "pos" : "neg"}>{pc(x.base.dcf.upside)}</span>, (x) => bad(x) ? "n/m" : <span className={x.base.dcf.upside >= 0 ? "pos" : "neg"}>{pc(x.base.dcf.upside)}</span>, true)}
              </tbody>
            </table>
            <p className="footnote">
              {((a && !a.error && bad(a)) || (b && !b.error && bad(b))) && <><b>n/m</b> = not meaningful: a standard DCF doesn&apos;t fit banks, insurers, or companies that aren&apos;t operating-profitable. </>}
              Both models use each company&apos;s own historical growth and margins as the Base case. Open either in the full model to change assumptions. Educational tool — not investment advice.
            </p>
          </div>
        )}
      </main>
      <div className="footer">Vexa · a free tool for learning financial modeling</div>
    </>
  );
}
