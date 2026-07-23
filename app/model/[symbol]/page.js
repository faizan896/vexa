"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { deriveState, runAll } from "@/lib/engine";
import { big, pc, px, curSym } from "@/lib/format";
import ModelControls from "@/components/ModelControls";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { AnimatedNumber } from "@/components/Motion";
import Term from "@/components/Term";
import Wizard from "@/components/Wizard";
import { Overview, ThreeStatement, DcfPanel, ScenariosPanel, SensitivityPanel, CapPanel, MaPanel, LboPanel } from "@/components/Panels";

const TABS = ["Overview", "3-Statement", "DCF", "Scenarios", "Sensitivity", "Capital Raising", "M&A", "LBO"];

function encodeShare(asm, scen) {
  const keep = { g: asm.growth, gm: asm.gm, sg: asm.sgaPct, b: asm.beta, tg: asm.tg, xm: asm.exitMult, pr: asm.prem, ps: asm.pctStock, le: asm.lboEntry, ll: asm.lboLev, ra: asm.raiseAmt, sc: scen };
  try { return btoa(JSON.stringify(keep)); } catch { return ""; }
}
function decodeShare() {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/v=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(atob(decodeURIComponent(m[1]))); } catch { return null; }
}

export default function ModelPage() {
  const { symbol } = useParams();
  const sym = decodeURIComponent(symbol || "").toUpperCase();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [scen, setScen] = useState(0);
  const [tab, setTab] = useState("Overview");
  const [wizard, setWizard] = useState(false);
  const [learnOn, setLearnOn] = useState(true);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (!state) return;
    const url = `${window.location.origin}/model/${encodeURIComponent(sym)}#v=${encodeURIComponent(encodeShare(state.asm, scen))}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2200);
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`/api/company/${encodeURIComponent(sym)}`);
        const j = await r.json();
        if (dead) return;
        if (!r.ok) return setError(j.error || "Could not load data.");
        const st = deriveState(j);
        // 1) shared link takes priority, 2) then saved, 3) else wizard
        const shared = decodeShare();
        if (shared) {
          const a = st.asm, s = shared;
          if (s.g) a.growth = s.g; if (s.gm) a.gm = s.gm; if (s.sg) a.sgaPct = s.sg;
          if (s.b != null) a.beta = s.b; if (s.tg != null) a.tg = s.tg; if (s.xm != null) a.exitMult = s.xm;
          if (s.pr != null) a.prem = s.pr; if (s.ps != null) a.pctStock = s.ps;
          if (s.le != null) a.lboEntry = s.le; if (s.ll != null) a.lboLev = s.ll; if (s.ra != null) a.raiseAmt = s.ra;
          setScen(s.sc || 0);
        } else {
          try {
            const saved = JSON.parse(localStorage.getItem("vexa_models") || "[]").find((m) => m.symbol === sym);
            if (saved?.asm) { st.asm = { ...st.asm, ...saved.asm }; setScen(saved.scenIdx || 0); }
            else setWizard(true);
          } catch { setWizard(true); }
        }
        setState(st);
      } catch {
        if (!dead) setError("Network problem — try again.");
      }
    })();
    return () => { dead = true; };
  }, [sym]);

  const R = useMemo(() => (state ? runAll(state, scen) : null), [state, scen]);
  const cur = state ? curSym(state.hist.currency) : "$";

  // autosave (debounced)
  useEffect(() => {
    if (!state || !R) return;
    const t = setTimeout(() => {
      try {
        const list = JSON.parse(localStorage.getItem("vexa_models") || "[]").filter((m) => m.symbol !== sym);
        list.unshift({
          symbol: sym, name: state.hist.name, savedAt: Date.now(), asm: state.asm, scenIdx: scen,
          scenario: ["Base", "Bull", "Bear"][scen], perShare: R.base.dcf.perShare, upside: R.base.dcf.upside, cur,
        });
        localStorage.setItem("vexa_models", JSON.stringify(list.slice(0, 24)));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [state, R, scen, sym, cur]);

  if (error)
    return (
      <Shell>
        <div className="err-box">
          <h2 className="serif">Hmm — {sym} didn't load</h2>
          <p>{error}</p>
          <Link className="btn ghost" style={{ width: "auto", padding: "12px 26px" }} href="/">← Back to search</Link>
        </div>
      </Shell>
    );
  if (!state || !R)
    return (
      <Shell>
        <section className="hero"><div className="inner">
          {[0, 1, 2].map((i) => (
            <div className="kpi" key={i}>
              <div className="skel skel-sm" />
              <div className="skel skel-lg" />
              <div className="skel skel-sm" />
            </div>
          ))}
        </div></section>
        <div className="sheet">
          <div className="skel-note">Pulling {sym}'s real financials & building your model…</div>
          <div className="card"><div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" style={{ width: "70%" }} /></div>
          <div className="card"><div className="skel skel-row" /><div className="skel skel-row" style={{ width: "85%" }} /><div className="skel skel-row" style={{ width: "60%" }} /></div>
        </div>
      </Shell>
    );

  const d = R.base.dcf, h = state.hist;
  // when the DCF can't produce a sensible answer (loss-making firms, banks/insurers whose
  // model doesn't fit), show a clear note instead of scary negative numbers
  const notMeaningful = !(d.ev > 0 && d.perShare > 0 && d.wacc > 0) || /bank|insurance/i.test(state.co?.industry || "");
  const suggested = {
    cagr: state.asm.growth[0], gm: state.asm.gm[0], sga: state.asm.sgaPct[0], beta: state.asm.beta,
    waccOf: (b) => {
      const ke = state.asm.rf + b * state.asm.erp, kdAT = state.asm.kd * (1 - state.asm.taxRate);
      const E = h.shares[h.shares.length - 1] * h.price, D = h.debt[h.debt.length - 1];
      const we = E + D > 0 ? E / (E + D) : 1;
      return we * ke + (1 - we) * kdAT;
    },
  };

  return (
    <Shell>
      <div className={learnOn ? "" : "hide-learn"}>
        {wizard && (
          <Wizard state={state} setAsm={(asm) => setState({ ...state, asm })} suggested={suggested} onDone={() => setWizard(false)} />
        )}
        <section className="hero">
          <div className="inner">
            <div className="kpi">
              <div className="smallcaps">{h.name} · intrinsic value</div>
              <div className="val">{notMeaningful ? "n/m" : <AnimatedNumber value={d.perShare} format={(x) => px(x, cur)} />}</div>
              <div className="sub">per share · {["Base", "Bull", "Bear"][scen]} case DCF</div>
            </div>
            <div className="kpi">
              <div className="smallcaps">vs. market price {px(h.price, cur)}</div>
              <div className="val" style={{ color: notMeaningful ? "#cbbfae" : d.upside >= 0 ? "#a8d5b5" : "#e8a79b" }}>{notMeaningful ? "n/m" : <AnimatedNumber value={d.upside} format={(x) => pc(x)} />}</div>
              <div className="sub">{notMeaningful ? "model doesn't fit this company" : d.upside >= 0 ? "model says undervalued" : "model says overvalued"}</div>
            </div>
            <div className="kpi">
              <div className="smallcaps">Enterprise value</div>
              <div className="val">{notMeaningful ? "n/m" : <>{cur}<AnimatedNumber value={d.ev} format={(x) => big(x)} /></>}</div>
              <div className="sub"><Term term="WACC" /> {pc(d.wacc, 2)} · TV {pc(d.tvPct, 0)} of value</div>
            </div>
          </div>
        </section>
        <div className="sheet">
          <div className="tabbar">
            {TABS.map((t) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
            ))}
            <button style={{ marginLeft: "auto" }} onClick={share}>{copied ? "✓ Link copied" : "↗ Share"}</button>
            <button onClick={() => setWizard(true)}>↻ Wizard</button>
          </div>
          {notMeaningful && (
            <div className="fit-warn">
              <b>Heads up — this model doesn't fit {h.name}.</b> Vexa is built for ordinary operating companies.
              {/bank|insurance/i.test(state.co?.industry || "")
                ? " Banks and insurers work completely differently — their debt is their product and there's no “cost of revenue”, so a standard DCF is meaningless here."
                : " This company isn't currently profitable on an operating basis, so a discounted-cash-flow value comes out negative and isn't useful."}
              {" "}You can still explore the tabs to learn, but try a profitable operating company — <a onClick={() => location.assign("/model/AAPL")} style={{ textDecoration: "underline", cursor: "pointer" }}>Apple</a>, Nike, or Coca-Cola — to see the model at its best.
            </div>
          )}
          <div className="two-col">
            <div style={{ display: "grid", gap: 20 }}>
              {tab === "Overview" && <Overview state={state} R={R} cur={cur} bad={notMeaningful} />}
              {tab === "3-Statement" && <ThreeStatement state={state} R={R} />}
              {tab === "DCF" && <DcfPanel state={state} R={R} cur={cur} />}
              {tab === "Scenarios" && <ScenariosPanel state={state} R={R} cur={cur} scen={scen} setScen={setScen} />}
              {tab === "Sensitivity" && <SensitivityPanel R={R} cur={cur} />}
              {tab === "Capital Raising" && <CapPanel state={state} R={R} cur={cur} />}
              {tab === "M&A" && <MaPanel state={state} R={R} cur={cur} />}
              {tab === "LBO" && <LboPanel state={state} R={R} cur={cur} />}
            </div>
            <ModelControls
              state={state} scen={scen} setScen={setScen} learnOn={learnOn} setLearnOn={setLearnOn}
              setAsm={(asm) => setState({ ...state, asm })}
            />
          </div>
          <div className="footer">
            {h.name} ({h.symbol}) · figures in {h.currency} millions · data: Financial Modeling Prep · educational tool, not investment advice
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/" className="logo-wrap">
            <Logo size={28} />
            <span className="logo">VE<span style={{ color: "var(--gold)" }}>XA</span></span>
          </Link>
          <nav className="site-nav">
            <Link href="/">New model</Link>
            <Link href="/compare">Compare</Link>
            <ThemeToggle />
            <button onClick={() => window.print()}>Export PDF</button>
            <a href="https://github.com/faizan896/vexa" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
