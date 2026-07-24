"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { px, pc } from "@/lib/format";
import Logo from "@/components/Logo";
import HeroBackdrop from "@/components/HeroBackdrop";
import ThemeToggle from "@/components/ThemeToggle";
import Ambient from "@/components/Ambient";
import HowItWorks from "@/components/HowItWorks";
import { Tilt, Magnetic } from "@/components/Motion";
import { scrollToSel } from "@/components/SmoothScroll";

const POPULAR = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "META", "KO"];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [emptyResult, setEmptyResult] = useState(false);
  const [saved, setSaved] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("vexa_models") || "[]"));
    } catch {}
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setEmptyResult(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : [];
        setResults(arr);
        setEmptyResult(arr.length === 0);
      } catch {
        setResults([]);
        setEmptyResult(true);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, -90]);
  const heroOp = useTransform(scrollY, [0, 560], [1, 0]);

  const open = (sym) => router.push(`/model/${encodeURIComponent(sym)}`);
  const removeSaved = (e, sym) => {
    e.stopPropagation();
    const next = saved.filter((m) => m.symbol !== sym);
    setSaved(next);
    localStorage.setItem("vexa_models", JSON.stringify(next));
  };
  const focusSearch = () => {
    scrollToSel(".cine-hero");
    const el = document.querySelector(".searchbox input");
    if (el) setTimeout(() => el.focus(), 260);
  };

  // reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* ---------------- CINEMATIC HERO ---------------- */}
      <section className="cine-hero">
        <HeroBackdrop />
        <header className="cine-header">
          <div className="logo-wrap">
            <Logo size={30} head="#f3e8d6" spark="#241610" />
            <div className="logo" style={{ color: "#f3e8d6" }}>VE<span>XA</span></div>
          </div>
          <nav className="site-nav">
            <button onClick={() => scrollToSel("#how")}>How it works</button>
            <a href="/compare">Compare</a>
            <ThemeToggle />
            <button onClick={focusSearch}>Start</button>
          </nav>
        </header>

        <div className="cine-labels">
          <span className="cl tl">(01) &nbsp;VALUATION STUDIO</span>
          <span className="cl tr">EST. 2026</span>
          <span className="cl bl">NEW YORK · LONDON · REMOTE</span>
          <span className="cl br">SCROLL ↓</span>
        </div>

        <motion.div className="cine-inner" style={{ y: heroY, opacity: heroOp }}>
          <div className="lp-eyebrow hin" style={{ animationDelay: "0.05s" }}>FINANCIAL MODELING · FOR EVERYONE</div>
          <h1 className="serif cine-h1">
            {["What is any company", "really worth?"].map((line, i) => (
              <span className="cine-line" key={i}>
                <span className="cine-line-in" style={{ animationDelay: `${0.12 + i * 0.15}s` }}>{line}</span>
              </span>
            ))}
          </h1>
          <p className="cine-sub hin" style={{ animationDelay: "0.72s" }}>
            Type a ticker and Vexa loads the company's real financials, then helps you build
            a full valuation — DCF, scenarios, M&amp;A, LBO. It's free, and it explains each step.
          </p>
          <div className="searchbox lp-search hin" style={{ animationDelay: "0.86s" }}>
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
            {results.length === 0 && emptyResult && q.trim().length >= 2 && (
              <div className="search-results search-empty">
                No US-listed match for “{q.trim()}”. Try the US ticker or ADR — e.g. TM for Toyota, BABA for Alibaba.
              </div>
            )}
          </div>
          <div className="chips hin" style={{ animationDelay: "0.96s" }}>
            <span className="chips-label">Try:</span>
            {POPULAR.map((s) => (
              <Magnetic key={s} className="chip-mag"><button onClick={() => open(s)}>{s}</button></Magnetic>
            ))}
          </div>
          <Magnetic className="lp-example-mag">
            <button className="lp-example hin" style={{ animationDelay: "1.04s" }} onClick={() => open("AAPL")}>
              or see a finished model for Apple →
            </button>
          </Magnetic>
        </motion.div>
      </section>

      <div className="sheet-wrap">
      <Ambient />
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
      <section className="lp-band reveal">
        <div className="lp-band-inner">
          <div className="smallcaps center">Why I built this</div>
          <h2 className="serif center lp-h2">Most people never learn to value a company.</h2>
          <div className="lp-cards3">
            <Tilt className="lp-card">
              <div className="lp-card-tag">It feels locked away</div>
              <p>Learning to value a company usually means long courses or dense textbooks — most people never make it past the introduction.</p>
            </Tilt>
            <Tilt className="lp-card">
              <div className="lp-card-tag">The blank page problem</div>
              <p>Even once you know the theory, you're left in front of an empty model with no idea where the first number goes. That's where most people stop.</p>
            </Tilt>
            <Tilt className="lp-card">
              <div className="lp-card-tag">A number with no story</div>
              <p>It's easy to find a "fair value" figure somewhere. But if you can't see how it was built, you can't check it — and you don't learn a thing.</p>
            </Tilt>
          </div>
          <p className="lp-turn">Vexa does it differently.</p>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS (pinned) ---------------- */}
      <HowItWorks />

      {/* ---------------- EXAMPLE GLIMPSE ---------------- */}
      <section className="lp-band reveal">
        <div className="lp-band-inner">
          <div className="smallcaps center">What you get</div>
          <h2 className="serif center lp-h2">You see how the number is built.</h2>
          <div className="lp-demo">
            <Tilt className="lp-demo-card" max={3}>
              <div className="lp-demo-head">
                <div>
                  <div className="smallcaps">Apple Inc. · intrinsic value</div>
                  <div className="lp-demo-big">$112.24</div>
                  <div className="lp-demo-note">per share · Base case DCF</div>
                </div>
                <div className="lp-demo-badge down">−65.6% vs price</div>
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
            </Tilt>
            <ul className="lp-demo-list">
              <li><b>It's honest about hype.</b> When a stock trades way above what its numbers support, Vexa tells you — and shows you what the market must be betting on to justify the price.</li>
              <li><b>Seven kinds of analysis.</b> The 3-statement model, DCF, scenarios, sensitivity, capital raising, M&amp;A and LBO — the same ones used at investment banks.</li>
              <li><b>Notes on every screen.</b> Each chart and table has a short note explaining what it means and why it matters.</li>
              <li><b>Everything updates live.</b> Change one assumption and the whole model recalculates on the spot.</li>
            </ul>
          </div>
          <div className="center"><Magnetic><button className="lp-cta" onClick={focusSearch}>Try it on a company →</button></Magnetic></div>
        </div>
      </section>

      {/* ---------------- WHO ITS FOR ---------------- */}
      <section className="lp-band alt reveal">
        <div className="lp-band-inner">
          <div className="smallcaps center">Who it's for</div>
          <div className="lp-who">
            <div><b>Finance students</b><span>Turn what you learned in class into something you can actually do — and put on your CV.</span></div>
            <div><b>Interview prep</b><span>Practise DCF and LBO questions on any real company, as many times as you want.</span></div>
            <div><b>Curious investors</b><span>Work out whether a stock looks cheap or expensive, and see the reasoning for yourself.</span></div>
          </div>
          <div className="lp-feat-row">
            {["3-Statement", "DCF", "Scenarios", "Sensitivity", "Capital Raising", "M&A", "LBO"].map((f) => (
              <span key={f} className="feat">{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- STORY + FAQ ---------------- */}
      <section className="lp-band reveal">
        <div className="lp-band-inner lp-narrow">
          <div className="smallcaps center">The story</div>
          <p className="lp-story">
            I wanted to understand how investors actually value a company, and every path I found was
            either expensive or started from a blank page I had no idea how to fill in.
            So I spent a while working it out, and then built the thing I wish I'd had at the start —
            somewhere you can pick a real company and watch a real valuation come together, one step at a time.
            It's free. If it helps even a few people get unstuck, that's enough.
          </p>

          <div className="smallcaps center" style={{ marginTop: 40 }}>Common questions</div>
          <div className="lp-faq">
            <div className="lp-qa">
              <div className="q">Which companies work?</div>
              <div className="a">Most large US-listed companies — Apple, Microsoft, Tesla, Coca-Cola and so on. Some smaller or non-US names aren't covered yet; if one doesn't load, try its US ticker.</div>
            </div>
            <div className="lp-qa">
              <div className="q">Where do the numbers come from?</div>
              <div className="a">Straight from each company's official financial filings, through the Financial Modeling Prep data service. Nothing here is made up.</div>
            </div>
            <div className="lp-qa">
              <div className="q">Should I trade on this?</div>
              <div className="a">No. Vexa is for learning how valuation works. A model is only as good as its assumptions, and every stock deserves real research before you risk money.</div>
            </div>
            <div className="lp-qa">
              <div className="q">Is it really free? Do I need an account?</div>
              <div className="a">Yes, and no. Nothing to sign up for. Your models are saved in your own browser, not on a server.</div>
            </div>
          </div>
        </div>
      </section>
      </div>{/* /sheet-wrap */}

      {/* ---------------- FOOTER ---------------- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="logo-wrap">
            <Logo size={26} />
            <div className="logo" style={{ fontSize: 18 }}>VE<span>XA</span></div>
          </div>
          <p>A free tool for learning financial modeling. Not investment advice.</p>
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
