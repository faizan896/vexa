"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { deriveState } from "@/lib/engine";
import { useRunAll } from "@/lib/useRunAll";
import { big, pc, px, curSym } from "@/lib/format";
import ModelControls from "@/components/ModelControls";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { AnimatedNumber } from "@/components/Motion";
import Term from "@/components/Term";
import Wizard from "@/components/Wizard";
import Walkthrough from "@/components/Walkthrough";
import Icon from "@/components/Icon";
import { exportModelXlsx } from "@/lib/exportXlsx";
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
// share links are user-controlled input — validate & clamp before feeding the engine
const okNum = (v) => typeof v === "number" && isFinite(v);
const okArr = (v) => Array.isArray(v) && v.length === 3 && v.every(okNum);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function applyShared(asm, s) {
  if (okArr(s.g)) asm.growth = s.g.map((x) => clamp(x, -0.5, 0.6));
  if (okArr(s.gm)) asm.gm = s.gm.map((x) => clamp(x, 0, 0.99));
  if (okArr(s.sg)) asm.sgaPct = s.sg.map((x) => clamp(x, 0, 0.95));
  if (okNum(s.b)) asm.beta = clamp(s.b, 0.1, 4);
  if (okNum(s.tg)) asm.tg = clamp(s.tg, -0.02, 0.06);
  if (okNum(s.xm)) asm.exitMult = clamp(s.xm, 1, 60);
  if (okNum(s.pr)) asm.prem = clamp(s.pr, -0.5, 3);
  if (okNum(s.ps)) asm.pctStock = clamp(s.ps, 0, 1);
  if (okNum(s.le)) asm.lboEntry = clamp(s.le, 1, 60);
  if (okNum(s.ll)) asm.lboLev = clamp(s.ll, 0, 15);
  if (okNum(s.ra)) asm.raiseAmt = clamp(s.ra, 0, 1e7);
  return [0, 1, 2].includes(s.sc) ? s.sc : 0;
}

export default function ModelClient() {
  const { symbol } = useParams();
  const sym = decodeURIComponent(symbol || "").toUpperCase();
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [scen, setScen] = useState(0);
  const [tab, setTab] = useState("Overview");
  const [wizard, setWizard] = useState(false);
  const [walk, setWalk] = useState(false);
  const [learnOn, setLearnOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [xlBusy, setXlBusy] = useState(false);
  const [audit, setAudit] = useState(false);
  const [traceKey, setTraceKey] = useState(0);
  const [reload, setReload] = useState(0);
  const [stale, setStale] = useState(false);
  const xlBusyRef = useRef(false);

  const exportXl = async () => {
    if (!state || !R || xlBusyRef.current) return;
    xlBusyRef.current = true; setXlBusy(true);
    try { await exportModelXlsx(state, R, cur, ["Base", "Bull", "Bear"][scen]); } catch {}
    xlBusyRef.current = false; setXlBusy(false);
  };

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
        setStale(!!j.stale);
        const st = deriveState(j);
        // 1) shared link takes priority, 2) then saved, 3) else wizard
        const shared = decodeShare();
        if (shared) {
          setScen(applyShared(st.asm, shared));
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
  }, [sym, reload]);

  const R = useRunAll(state, scen);
  const cur = state ? curSym(state.hist.currency) : "$";

  // live delta attribution — show how much the last change moved intrinsic value
  const prevPS = useRef(null);
  const [delta, setDelta] = useState(null);
  const deltaTimer = useRef(null);
  useEffect(() => {
    if (!R) return;
    const dd = R.base.dcf, ps = dd.perShare;
    const bad = !(dd.ev > 0 && ps > 0 && dd.wacc > 0);
    if (bad || !isFinite(ps)) { prevPS.current = null; setDelta(null); return; }
    if (prevPS.current != null && Math.abs(ps - prevPS.current) > 0.01) {
      const abs = ps - prevPS.current;
      setDelta({ abs, pct: prevPS.current ? abs / prevPS.current : 0 });
      clearTimeout(deltaTimer.current);
      deltaTimer.current = setTimeout(() => setDelta(null), 3400);
    }
    prevPS.current = ps;
  }, [R]);

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
          <h1 className="serif">Hmm — {sym} didn't load</h1>
          <p>{error}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn ghost" style={{ width: "auto", padding: "12px 26px" }}
              onClick={() => { setError(null); setState(null); setReload((x) => x + 1); }}>Retry</button>
            <Link className="btn ghost" style={{ width: "auto", padding: "12px 26px" }} href="/">← Back to search</Link>
          </div>
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
          <div className="skel-note">Loading {sym} filings and building the model…</div>
          <div className="card"><div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" style={{ width: "70%" }} /></div>
          <div className="card"><div className="skel skel-row" /><div className="skel skel-row" style={{ width: "85%" }} /><div className="skel skel-row" style={{ width: "60%" }} /></div>
        </div>
      </Shell>
    );

  const d = R.base.dcf, h = state.hist;
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

  // Trace-to-input: every headline output decomposed into the exact figures behind it
  const L = h.shares.length - 1;
  const traces = [
    {
      title: "how intrinsic value per share is built",
      rows: [
        ["Enterprise value", `${cur}${big(d.ev)}`],
        ["− Net debt (total debt − cash)", `${cur}${big(d.netDebt)}`],
        ["= Equity value", `${cur}${big(d.eqV)}`],
        ["÷ Diluted shares outstanding", `${big(h.shares[L])} M`],
        ["= Intrinsic value / share", px(d.perShare, cur)],
      ],
      note: `Cross-check via the exit-multiple method: ${px(d.perShareExit, cur)} / share.`,
    },
    {
      title: "how upside vs. the market is computed",
      rows: [
        ["Intrinsic value / share", px(d.perShare, cur)],
        ["Current market price", px(h.price, cur)],
        ["Upside = intrinsic ÷ price − 1", pc(d.upside)],
      ],
      note: d.upside >= 0
        ? "Positive → the model sees the shares as cheaper than their fundamentals justify."
        : "Negative → the model sees the shares as pricier than the fundamentals support.",
    },
    {
      title: "how enterprise value & WACC are built",
      rows: [
        ["Cost of equity (rf + β·ERP)", `${pc(state.asm.rf)} + ${state.asm.beta.toFixed(2)}·${pc(state.asm.erp)} = ${pc(d.ke, 2)}`],
        ["After-tax cost of debt", pc(d.kdAT, 2)],
        ["Equity weight / debt weight", `${pc(d.we, 1)} / ${pc(d.wd, 1)}`],
        ["WACC (equity-wt × cost of equity + debt-wt × after-tax debt)", pc(d.wacc, 2)],
        ["PV of 5-yr forecast FCF", `${cur}${big(d.pvF)}`],
        ["+ PV of terminal value", `${cur}${big(d.pvTV)}`],
        ["= Enterprise value", `${cur}${big(d.ev)}`],
      ],
      note: `Terminal value is ${pc(d.tvPct, 0)} of enterprise value (terminal growth ${pc(state.asm.tg)}, held below long-run GDP).`,
    },
  ];
  const openTrace = (i) => { if (audit && !notMeaningful) setTraceKey(i); };

  return (
    <Shell>
      <h1 className="sr-only">{h.name} ({h.symbol}) — Vexa valuation</h1>
      <div className={learnOn ? "" : "hide-learn"}>
        {wizard && (
          <Wizard state={state} setAsm={(asm) => setState({ ...state, asm })} suggested={suggested} onDone={() => setWizard(false)} />
        )}
        {walk && <Walkthrough state={state} R={R} cur={cur} onClose={() => setWalk(false)} />}
        <section className={"hero" + (audit && !notMeaningful ? " audit-on" : "")}>
          <div className="inner">
            <div className={"kpi" + (audit && traceKey === 0 && !notMeaningful ? " tracing" : "")}
              onClick={() => openTrace(0)} role={audit ? "button" : undefined} tabIndex={audit ? 0 : undefined}
              onKeyDown={(e) => { if (audit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTrace(0); } }}>
              <div className="smallcaps">{h.name} · intrinsic value</div>
              <div className="val">{notMeaningful ? <abbr className="nm" title="Not meaningful — a standard DCF doesn't fit this company">n/m</abbr> :<AnimatedNumber value={d.perShare} format={(x) => px(x, cur)} />}</div>
              <div className="sub" aria-live="polite">
                {delta && !notMeaningful
                  ? <span className={delta.abs >= 0 ? "pos" : "neg"}>
                      <Icon name={delta.abs >= 0 ? "up" : "down"} size={12} />
                      {" "}{delta.abs >= 0 ? "+" : "−"}{px(Math.abs(delta.abs), cur)} ({delta.pct >= 0 ? "+" : "−"}{pc(Math.abs(delta.pct))}) from last change
                    </span>
                  : <>per share · {["Base", "Bull", "Bear"][scen]} case DCF</>}
              </div>
            </div>
            <div className={"kpi" + (audit && traceKey === 1 && !notMeaningful ? " tracing" : "")}
              onClick={() => openTrace(1)} role={audit ? "button" : undefined} tabIndex={audit ? 0 : undefined}
              onKeyDown={(e) => { if (audit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTrace(1); } }}>
              <div className="smallcaps">vs. market price {px(h.price, cur)}</div>
              <div className="val" style={{ color: notMeaningful ? "#cbbfae" : d.upside >= 0 ? "#a8d5b5" : "#e8a79b" }}>{notMeaningful ? <abbr className="nm" title="Not meaningful — a standard DCF doesn't fit this company">n/m</abbr> :<AnimatedNumber value={d.upside} format={(x) => pc(x)} />}</div>
              <div className="sub">{notMeaningful ? "model doesn't fit this company" : d.upside >= 0 ? "model says undervalued" : "model says overvalued"}</div>
            </div>
            <div className={"kpi" + (audit && traceKey === 2 && !notMeaningful ? " tracing" : "")}
              onClick={() => openTrace(2)} role={audit ? "button" : undefined} tabIndex={audit ? 0 : undefined}
              onKeyDown={(e) => { if (audit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTrace(2); } }}>
              <div className="smallcaps">Enterprise value</div>
              <div className="val">{notMeaningful ? <abbr className="nm" title="Not meaningful — a standard DCF doesn't fit this company">n/m</abbr> :<>{cur}<AnimatedNumber value={d.ev} format={(x) => big(x)} /></>}</div>
              <div className="sub"><Term term="WACC" /> {pc(d.wacc, 2)} · TV {pc(d.tvPct, 0)} of value</div>
            </div>
          </div>
        </section>
        <div className="sheet">
          <div className="provenance">
            <span>Based on {(h.years && h.years[0]) || "recent"}{h.years && h.years.length > 1 && h.years[h.years.length - 1] !== h.years[0] ? `–${h.years[h.years.length - 1]}` : ""} filings</span>
            <span className="dot">·</span>
            <span>{h.exchange || state.co?.exchange || "US-listed"} · {h.currency}</span>
            <span className="dot">·</span>
            <span>live price {px(h.price, cur)} via Financial Modeling Prep</span>
            {stale && <span className="stale-badge" role="status">cached · provider briefly unavailable</span>}
            {!notMeaningful && (
              <button className={"prov-audit" + (audit ? " on" : "")} aria-pressed={audit}
                onClick={() => { setAudit((a) => !a); setTraceKey(0); }}>
                <Icon name={audit ? "check" : "audit"} size={13} />
                {audit ? " Audit mode — click a KPI to trace it" : " Trace the math"}
              </button>
            )}
          </div>
          {state.co?.flags?.length > 0 && (
            <div className="data-flags">Data note: {state.co.flags.join(" ")}</div>
          )}
          {audit && !notMeaningful && (
            <div className="trace-card" role="region" aria-label="Calculation trace">
              <div className="trace-head">
                <span className="smallcaps">Audit — {traces[traceKey].title}</span>
                <button className="wt-close" onClick={() => setAudit(false)} aria-label="Exit audit mode"><Icon name="x" size={15} /></button>
              </div>
              <table className="trace-tbl"><tbody>
                {traces[traceKey].rows.map((r, i) => (
                  <tr key={i} className={i === traces[traceKey].rows.length - 1 ? "tr-total" : ""}>
                    <td>{r[0]}</td><td className="tr-val">{r[1]}</td>
                  </tr>
                ))}
              </tbody></table>
              <div className="trace-note">{traces[traceKey].note}</div>
              <div className="trace-hint">Every figure above flows from the assumptions in Model Controls — change one and the whole chain recomputes. Click another KPI to trace it.</div>
            </div>
          )}
          <div className="tabbar">
            <div className="tabbar-tabs" role="tablist" aria-label="Analyses"
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = TABS.indexOf(tab);
                const n = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
                setTab(TABS[n]);
                document.getElementById(`tab-${TABS[n]}`)?.focus();
              }}>
              {TABS.map((t) => (
                <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls="model-tabpanel"
                  tabIndex={tab === t ? 0 : -1}
                  className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div className="tabbar-actions">
              <button className="act" disabled={notMeaningful}
                title={notMeaningful ? "Best on a profitable operating company — open Apple to try it" : "Learn how the three statements connect"}
                onClick={() => setWalk(true)}><Icon name="play" size={13} /> Walkthrough</button>
              <button className="act" onClick={exportXl}><Icon name="download" size={13} /> {xlBusy ? "…" : "Excel"}</button>
              <button className="act" onClick={share}><Icon name={copied ? "check" : "share"} size={13} /> {copied ? "Copied" : "Share"}</button>
              <button className="act" onClick={() => setWizard(true)}><Icon name="refresh" size={13} /> Wizard</button>
            </div>
          </div>
          {!notMeaningful && (
            <div className="scen-strip" role="group" aria-label="Compare scenarios">
              {["Base", "Bull", "Bear"].map((n, i) => {
                const sd = R.scenarios[i].dcf;
                return (
                  <button key={n} className={"scen-chip" + (scen === i ? " on" : "")} aria-pressed={scen === i} onClick={() => setScen(i)}>
                    <span className="sc-name">{n}</span>
                    <span className="sc-val">{px(sd.perShare, cur)}</span>
                    <span className={"sc-up " + (sd.upside >= 0 ? "pos" : "neg")}>{sd.upside >= 0 ? "+" : ""}{pc(sd.upside)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {notMeaningful && (
            <div className="fit-warn" role="note">
              <b>Heads up — this model doesn't fit {h.name}.</b> Vexa is built for ordinary operating companies.
              {/bank|insurance/i.test(state.co?.industry || "")
                ? " Banks and insurers work completely differently — their debt is their product and there's no “cost of revenue”, so a standard DCF is meaningless here."
                : " This company isn't currently profitable on an operating basis, so a discounted-cash-flow value comes out negative and isn't useful."}
              {" "}You can still explore the tabs to learn, but try a profitable operating company — <Link href="/model/AAPL" style={{ textDecoration: "underline" }}>Apple</Link>, Nike, or Coca-Cola — to see the model at its best.
            </div>
          )}
          <div className="two-col">
            <div id="model-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ display: "grid", gap: 20 }}>
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
          <Link href="/" className="logo-wrap" aria-label="Vexa home">
            <Logo size={28} />
            <span className="logo">VE<span style={{ color: "var(--gold)" }}>XA</span></span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
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
