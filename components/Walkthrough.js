"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { big } from "@/lib/format";
import { useFocusTrap } from "@/components/useFocusTrap";
import Icon from "@/components/Icon";

/**
 * Beginner mode — animates how the income statement, cash flow and balance sheet
 * link together, using the company's own first-forecast-year numbers.
 */
export default function Walkthrough({ state, R, cur = "$", onClose }) {
  const [i, setI] = useState(0);
  const f = R.base.f;
  const m = (v) => cur + big(v);

  // first forecast year figures
  const D = {
    rev: f.rev[0], gp: f.gp[0], ebit: f.ebit[0], ni: f.ni[0],
    da: f.da[0], capex: f.capexF[0], nwc: f.nwcChg[0], cfo: f.cfo[0],
    cash: f.cash[0], ta: f.ta[0], debt: f.debt[0], eq: f.eq[0], tle: f.tle[0],
  };

  const steps = [
    {
      t: "Three statements, one connected model",
      b: "A financial model isn't three separate tables — it's one machine. The income statement feeds the cash flow, the cash flow feeds the balance sheet, and the balance sheet must always balance. Let's follow the money through " + (state.hist.name || "this company").replace(/\.$/, "") + ".",
      hi: { is: [], cf: [], bs: [] }, flow: null,
    },
    {
      t: "1 · The income statement ends in profit",
      b: "Start at the top with revenue of " + m(D.rev) + ". Subtract costs and expenses and you work down to net income — the profit left for owners: " + m(D.ni) + ". This single number is where the next statement begins.",
      hi: { is: ["rev", "ni"], cf: [], bs: [] }, flow: null,
    },
    {
      t: "2 · Net income starts the cash flow",
      b: "Net income (" + m(D.ni) + ") jumps to the top of the cash flow statement. But profit isn't cash yet — the next step fixes that.",
      hi: { is: ["ni"], cf: ["ni"], bs: [] }, flow: "is-cf",
    },
    {
      t: "3 · Turn profit into real cash",
      b: "Add back D&A of " + m(D.da) + " (an accounting charge, not a cash outflow), then subtract capital spending of " + m(D.capex) + " and working-capital changes. What's left is the cash the business actually generated.",
      hi: { is: [], cf: ["ni", "da", "capex", "cfo"], bs: [] }, flow: null,
    },
    {
      t: "4 · Cash lands on the balance sheet",
      b: "That cash flows into the cash line on the balance sheet: " + m(D.cash) + ". Meanwhile the profit you kept is added to equity — so both sides of the model move together.",
      hi: { is: [], cf: ["cfo"], bs: ["cash", "eq"] }, flow: "cf-bs",
    },
    {
      t: "5 · And it always balances",
      b: "The golden rule: everything the company owns equals what it owes plus what owners hold. Total assets " + m(D.ta) + " = liabilities + equity " + m(D.tle) + ". If that ties out, your model is internally consistent — that's the whole game.",
      hi: { is: [], cf: [], bs: ["ta", "tle"] }, flow: null,
    },
  ];

  const s = steps[i];
  const panelRef = useRef(null);
  useFocusTrap(panelRef, onClose);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" && i < steps.length - 1) setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, steps.length]);

  const Line = ({ id, label, val, set }) => {
    const active = set.includes(id);
    return (
      <div className={"wt-line" + (active ? " on" : "")}>
        <span>{label}</span>
        <span className="wt-num">{val}</span>
      </div>
    );
  };

  const Card = ({ title, tag, children, glow }) => (
    <motion.div className={"wt-card" + (glow ? " glow" : "")} layout
      animate={{ scale: glow ? 1 : 0.99, opacity: glow ? 1 : 0.72 }} transition={{ duration: 0.4 }}>
      <div className="wt-card-tag">{tag}</div>
      <div className="wt-card-title">{title}</div>
      {children}
    </motion.div>
  );

  const anyIS = s.hi.is.length > 0, anyCF = s.hi.cf.length > 0, anyBS = s.hi.bs.length > 0;

  return (
    <div className="wt-overlay" onClick={onClose} data-lenis-prevent>
      <motion.div className="wt-panel" onClick={(e) => e.stopPropagation()}
        ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="wt-heading"
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}>
        <div className="wt-head">
          <div className="smallcaps" id="wt-heading">Beginner walkthrough</div>
          <button className="wt-close" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>

        <div className="wt-stage">
          <Card tag="Income statement" title="Profit" glow={anyIS || i === 0}>
            <Line id="rev" label="Revenue" val={m(D.rev)} set={s.hi.is} />
            <Line id="gp" label="Gross profit" val={m(D.gp)} set={s.hi.is} />
            <Line id="ebit" label="Operating profit" val={m(D.ebit)} set={s.hi.is} />
            <Line id="ni" label="Net income" val={m(D.ni)} set={s.hi.is} />
          </Card>

          <div className={"wt-arrow" + (s.flow === "is-cf" ? " on" : "")}><Icon name="arrowRight" size={18} /></div>

          <Card tag="Cash flow" title="Cash" glow={anyCF || i === 0}>
            <Line id="ni" label="Net income" val={m(D.ni)} set={s.hi.cf} />
            <Line id="da" label="+ D&A" val={m(D.da)} set={s.hi.cf} />
            <Line id="capex" label="− Capex" val={m(D.capex)} set={s.hi.cf} />
            <Line id="cfo" label="= Cash generated" val={m(D.cfo)} set={s.hi.cf} />
          </Card>

          <div className={"wt-arrow" + (s.flow === "cf-bs" ? " on" : "")}><Icon name="arrowRight" size={18} /></div>

          <Card tag="Balance sheet" title="Balances" glow={anyBS || i === 0}>
            <Line id="cash" label="Cash" val={m(D.cash)} set={s.hi.bs} />
            <Line id="ta" label="Total assets" val={m(D.ta)} set={s.hi.bs} />
            <Line id="eq" label="Equity" val={m(D.eq)} set={s.hi.bs} />
            <Line id="tle" label="Liabilities + equity" val={m(D.tle)} set={s.hi.bs} />
          </Card>
        </div>

        <div className="wt-body">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <h3 className="serif wt-title">{s.t}</h3>
              <p className="wt-text">{s.b}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="wt-foot">
          <div className="wt-dots">
            {steps.map((_, k) => (
              <button key={k} className={"wt-dot" + (k === i ? " on" : "")} onClick={() => setI(k)} aria-label={"Step " + (k + 1)} />
            ))}
          </div>
          <div className="wt-nav">
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))}>← Back</button>
            {i < steps.length - 1
              ? <button className="btn" onClick={() => setI(i + 1)}>Next →</button>
              : <button className="btn" onClick={onClose}>Got it ✓</button>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
