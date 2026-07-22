"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { px, pc } from "@/lib/format";
import Logo from "@/components/Logo";

const POPULAR = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "META", "KO"];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("vexa_models") || "[]"));
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
    localStorage.setItem("vexa_models", JSON.stringify(next));
  };
  const focusSearch = () => {
    const el = document.querySelector(".searchbox input");
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
  };

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <div className="logo-wrap">
            <Logo size={30} />
            <div className="logo">VE<span>XA</span></div>
          </div>
          <nav className="site-nav">
            <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>How it works</button>
            <button onClick={focusSearch}>Start</button>
          </nav>
        </div>
      </header>

      {/* ---------------- HERO ---------------- */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-eyebrow">FINANCIAL MODELING · FOR EVERYONE</div>
          <h1 className="serif">What is any company<br />really worth?</h1>
          <p className="lp-sub">
            Type a ticker. Vexa pulls the real financials and walks you through a full,
            banker-grade valuation — DCF, scenarios, M&amp;A, LBO and more. Built to teach,
            not to guess. No Excel, no jargon, no cost.
          </p>
          <div className="searchbox lp-search">
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
                    <span><span className="sym">{r.symbol}</span> &nbsp;{r.name}</span>
                    <span className="exch">{r.exchange || r.exchangeFullName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="chips">
            <span className="chips-label">Try:</span>
            {POPULAR.map((s) => (
              <button key={s} onClick={() => open(s)}>{s}</button>
            ))}
          </div>
        </div>
      </section>

      {saved.length > 0 && (
        <section className="lp-saved">
          <div className="lp-band-inner">
            <div className="smallcaps">Your recent models</div>
            <div className="saved-row">
              {saved.slice(0, 6).map((m) => (
                <button key={m.symbol} className="model-card" onClick={() => open(m.symbol)}>
                  <div className="nm">{m.name}</div>
                  <div className="meta">
                    {m.symbol} · {m.scenario} case ·{" "}
                    <span onClick={(e) => removeSaved(e, m.symbol)} style={{ textDecoration: "underline" }}>remove</span>
                  </div>
                  <div className="val">
                    {px(m.perShare, m.cur)}
                    <span className={"badge " + (m.upside >= 0 ? "up" : "down")}>{pc(m.upside)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- PROBLEM ---------------- */}
      <section className="lp-band">
        <div className="lp-band-inner">
          <div className="smallcaps center">The problem</div>
          <h2 className="serif center lp-h2">Learning to value a company is broken.</h2>
          <div className="lp-cards3">
            <div className="lp-card">
              <div className="lp-card-tag">$500+ courses</div>
              <p>Wall Street Prep, CFI and the rest hand you Excel templates and a paywall. Most people never finish.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-tag">A scary blank sheet</div>
              <p>YouTube shows you the theory, then leaves you alone with Excel — which formula, which link, which assumption? 90% quit here.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-tag">Black-box apps</div>
              <p>Other tools spit out "fair value = $X" and hide the reasoning. You learn nothing, and you can't tell if it's right.</p>
            </div>
          </div>
          <p className="lp-turn">Vexa is the opposite of all three.</p>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="lp-band alt" id="how">
        <div className="lp-band-inner">
          <div className="smallcaps center">How it works</div>
          <h2 className="serif center lp-h2">A full model in three steps.</h2>
          <div className="steps3 lp-steps">
            <div className="step3"><div className="n">1</div><div><b>Pick a company</b><br />Search any listed company — its real financials load straight from official filings.</div></div>
            <div className="step3"><div className="n">2</div><div><b>Answer 4 questions</b><br />Growth, profitability, risk, the long run — each pre-filled with a data-driven suggestion. Plain language, no jargon.</div></div>
            <div className="step3"><div className="n">3</div><div><b>Get the full model</b><br />A complete valuation with live charts. Every number is explained; every assumption is yours to change.</div></div>
          </div>
        </div>
      </section>

      {/* ---------------- EXAMPLE GLIMPSE ---------------- */}
      <section className="lp-band">
        <div className="lp-band-inner">
          <div className="smallcaps center">What you get</div>
          <h2 className="serif center lp-h2">Not a number. An argument you can inspect.</h2>
          <div className="lp-demo">
            <div className="lp-demo-card">
              <div className="lp-demo-head">
                <div>
                  <div className="smallcaps">Apple Inc. · intrinsic value</div>
                  <div className="lp-demo-big">$112.23</div>
                  <div className="lp-demo-note">per share · Base case DCF</div>
                </div>
                <div className="lp-demo-badge down">−65.8% vs price</div>
              </div>
              <div className="lp-ff">
                {[
                  { l: "52-week range", w: 62, x: 30 },
                  { l: "DCF — Gordon growth", w: 26, x: 8 },
                  { l: "Bear → Bull", w: 18, x: 5 },
                  { l: "Sensitivity", w: 34, x: 12 },
                ].map((b, i) => (
                  <div className="lp-ff-row" key={i}>
                    <span className="lp-ff-lbl">{b.l}</span>
                    <span className="lp-ff-track"><span className="lp-ff-bar" style={{ width: b.w + "%", marginLeft: b.x + "%" }} /></span>
                  </div>
                ))}
                <div className="lp-ff-price"><span>market price</span></div>
              </div>
            </div>
            <ul className="lp-demo-list">
              <li><b>Story-stock alerts.</b> When the market pays far more than the numbers justify, Vexa says so — and hands you the reverse-DCF to find out what buyers must believe.</li>
              <li><b>Seven analyses, one dataset.</b> 3-statement model, DCF, scenarios, sensitivity, capital raising, M&amp;A and LBO — the same tools an investment bank uses.</li>
              <li><b>Learn mode on every screen.</b> Each chart and table comes with a plain-English note: what it is, why it matters, what to argue about.</li>
              <li><b>Change anything, instantly.</b> Drag one assumption and all seven analyses recompute live.</li>
            </ul>
          </div>
          <div className="center"><button className="lp-cta" onClick={focusSearch}>Value a company now →</button></div>
        </div>
      </section>

      {/* ---------------- WHO ITS FOR ---------------- */}
      <section className="lp-band alt">
        <div className="lp-band-inner">
          <div className="smallcaps center">Who it's for</div>
          <div className="lp-who">
            <div><b>Finance students</b><span>Turn textbook theory into a real skill you can put on a CV.</span></div>
            <div><b>Interview prep</b><span>Practise DCF walk-throughs and paper LBOs on any real company, free and unlimited.</span></div>
            <div><b>Curious investors</b><span>Answer "is this stock cheap?" — and actually see the reasoning behind the answer.</span></div>
          </div>
          <div className="lp-feat-row">
            {["3-Statement", "DCF", "Scenarios", "Sensitivity", "Capital Raising", "M&A", "LBO"].map((f) => (
              <span key={f} className="feat">{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="logo-wrap">
            <Logo size={26} />
            <div className="logo" style={{ fontSize: 18 }}>VE<span>XA</span></div>
          </div>
          <p>Financial modeling for everyone. Educational tool — not investment advice.</p>
          <div className="lp-footer-links">
            <button onClick={focusSearch}>Start a model</button>
            <a href="https://github.com/faizan896/vexa" target="_blank" rel="noreferrer">View source</a>
            <span>Market data by Financial Modeling Prep</span>
          </div>
        </div>
      </footer>
    </>
  );
}
