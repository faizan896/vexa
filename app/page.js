"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { px, pc } from "@/lib/format";
import Logo from "@/components/Logo";

const POPULAR = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "DPZ", "KO", "NKE"];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("forecastly_models") || "[]"));
    } catch {}
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(Array.isArray(j) ? j : []);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const open = (sym) => router.push(`/model/${encodeURIComponent(sym)}`);
  const removeSaved = (e, sym) => {
    e.stopPropagation();
    const next = saved.filter((m) => m.symbol !== sym);
    setSaved(next);
    localStorage.setItem("forecastly_models", JSON.stringify(next));
  };

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <div className="logo-wrap">
            <Logo size={30} />
            <div className="logo">FORECAST<span>LY</span></div>
          </div>
          <nav className="site-nav">
            <a href="https://github.com/faizan896/forecastly" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <section className="home-hero">
        <h1 className="serif">What are we modeling today?</h1>
        <p className="tag">
          Type any listed company. Forecastly pulls its real financials and walks you through a full
          model — DCF, scenarios, M&amp;A, LBO and more. No Excel required.
        </p>
        <div className="searchbox">
          <input
            placeholder="Search a company or ticker — Apple, TSLA, Coca-Cola…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) open(results[0]?.symbol || q.trim().toUpperCase());
            }}
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map((r) => (
                <button key={r.symbol} onClick={() => open(r.symbol)}>
                  <span>
                    <span className="sym">{r.symbol}</span> &nbsp;{r.name}
                  </span>
                  <span className="exch">{r.exchange || r.exchangeFullName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="chips">
          {POPULAR.map((s) => (
            <button key={s} onClick={() => open(s)}>{s}</button>
          ))}
        </div>
      </section>

      <section className="purpose">
        <div className="purpose-inner">
          <div className="smallcaps" style={{ textAlign: "center" }}>How it works</div>
          <div className="steps3">
            <div className="step3"><div className="n">1</div><div><b>Pick a company</b><br />Search any listed company — its real financials load from SEC filings automatically.</div></div>
            <div className="step3"><div className="n">2</div><div><b>Answer 4 questions</b><br />Growth, profitability, risk — each pre-filled with data-driven suggestions. No jargon.</div></div>
            <div className="step3"><div className="n">3</div><div><b>Get the full model</b><br />A complete valuation with live charts — every number explained, every assumption yours to change.</div></div>
          </div>
          <div className="smallcaps" style={{ textAlign: "center", marginTop: 34 }}>What's inside every model</div>
          <div className="feat-row">
            {["3-Statement Model", "DCF Valuation", "Scenarios", "Sensitivity", "Capital Raising", "M&A", "LBO"].map((f) => (
              <span key={f} className="feat">{f}</span>
            ))}
          </div>
          <p className="purpose-note">
            The same frameworks investment banks use — rebuilt for learning. Free, in your browser, no Excel required.
          </p>
        </div>
      </section>

      <section className="saved-grid">
        {saved.map((m) => (
          <button key={m.symbol} className="model-card" onClick={() => open(m.symbol)}>
            <div className="nm">{m.name}</div>
            <div className="meta">
              {m.symbol} · {m.scenario} case · {new Date(m.savedAt).toLocaleDateString()}
              {" · "}
              <span onClick={(e) => removeSaved(e, m.symbol)} style={{ textDecoration: "underline" }}>remove</span>
            </div>
            <div className="val serif">
              {px(m.perShare, m.cur)}
              <span className={"badge " + (m.upside >= 0 ? "up" : "down")}>{pc(m.upside)}</span>
            </div>
          </button>
        ))}
        <button className="model-card new" onClick={() => document.querySelector(".searchbox input")?.focus()}>
          + New model — search a company above
        </button>
      </section>

      <div className="footer">
        Forecastly · educational tool, not investment advice · market data by Financial Modeling Prep
      </div>
    </>
  );
}
