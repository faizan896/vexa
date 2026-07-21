"use client";
import { useState } from "react";
import { pc } from "@/lib/format";

/**
 * 4-step guided wizard shown the first time a company is opened.
 * Every step comes pre-filled with data-derived suggestions — user can just keep clicking Next.
 */
export default function Wizard({ state, setAsm, onDone, suggested }) {
  const [step, setStep] = useState(0);
  const a = state.asm;
  const upd = (patch) => setAsm({ ...a, ...patch });
  const updScen = (key, idx, v) => {
    const arr = [...a[key]]; arr[idx] = v; upd({ [key]: arr });
  };

  const steps = [
    {
      tag: "Welcome",
      title: `We just pulled ${state.hist.name}'s real financials`,
      exp: `Revenue, profits, balance sheet, cash flow — the last three fiscal years, straight from official filings. Now answer 4 quick questions about the future (each comes pre-filled with a data-driven suggestion) and Vexa will build the complete model: valuation, scenarios, deal analyses, everything.`,
      body: (
        <div className="suggest" style={{ lineHeight: 1.7 }}>
          Latest fiscal year revenue: <b>{Math.round(state.hist.rev[state.hist.rev.length - 1]).toLocaleString()}M {state.hist.currency}</b>
          <br />Nothing to memorize — you can change every assumption later, and the yellow 📘 notes explain each concept as you go. Confused? Just hit Skip.
        </div>
      ),
      apply: () => {},
    },
    {
      tag: "Step 1 of 4 — Growth",
      title: "How fast will revenue grow?",
      exp: `Over the last 3 fiscal years, ${state.hist.name} grew revenue about ${pc(suggested.cagr)} per year. Your Base case is pre-set near that — drag to override if you believe the future looks different.`,
      body: (
        <>
          <div className="sliderline">
            <input type="range" min={-10} max={30} step={0.5} value={+(a.growth[0] * 100).toFixed(1)}
              onChange={(e) => updScen("growth", 0, +e.target.value / 100)} />
            <div className="bigval serif">{pc(a.growth[0])}</div>
          </div>
          <div className="suggest">Suggested (3-yr history): <b>{pc(suggested.cagr)}</b> · Bull and Bear are set ±3pp around your Base automatically — you can fine-tune them later in Model Controls.</div>
        </>
      ),
      apply: () => {
        upd({ growth: [a.growth[0], Math.min(a.growth[0] + 0.03, 0.3), Math.max(a.growth[0] - 0.03, -0.1)] });
      },
    },
    {
      tag: "Step 2 of 4 — Profitability",
      title: "How profitable is the business?",
      exp: "Gross margin = what's left after direct costs. Operating costs (SG&A, R&D) come out next. Both are pre-set to the company's most recent actuals.",
      body: (
        <>
          <label className="smallcaps">Gross margin</label>
          <div className="sliderline">
            <input type="range" min={5} max={95} step={0.5} value={+(a.gm[0] * 100).toFixed(1)}
              onChange={(e) => updScen("gm", 0, +e.target.value / 100)} />
            <div className="bigval serif">{pc(a.gm[0])}</div>
          </div>
          <label className="smallcaps">Operating costs (% of revenue)</label>
          <div className="sliderline">
            <input type="range" min={2} max={80} step={0.5} value={+(a.sgaPct[0] * 100).toFixed(1)}
              onChange={(e) => updScen("sgaPct", 0, +e.target.value / 100)} />
            <div className="bigval serif">{pc(a.sgaPct[0])}</div>
          </div>
          <div className="suggest">Last actuals: gross margin <b>{pc(suggested.gm)}</b>, operating costs <b>{pc(suggested.sga)}</b>. Operating margin implied: <b>{pc(a.gm[0] - a.sgaPct[0])}</b>.</div>
        </>
      ),
      apply: () => {},
    },
    {
      tag: "Step 3 of 4 — The discount rate",
      title: "How risky is this company?",
      exp: "Future cash needs discounting to today. Beta measures how much the stock swings vs. the market — riskier businesses get a higher discount rate (WACC), which lowers today's value.",
      body: (
        <>
          <label className="smallcaps">Beta (risk vs. market)</label>
          <div className="sliderline">
            <input type="range" min={0.3} max={2.5} step={0.05} value={a.beta}
              onChange={(e) => upd({ beta: +e.target.value })} />
            <div className="bigval serif">{a.beta.toFixed(2)}</div>
          </div>
          <div className="suggest">
            Market-observed beta: <b>{suggested.beta.toFixed(2)}</b> · Implied WACC with your beta:{" "}
            <b>{pc(suggested.waccOf(a.beta), 2)}</b> (risk-free {pc(a.rf)} + beta × {pc(a.erp)} equity premium, blended with after-tax debt cost)
          </div>
        </>
      ),
      apply: () => {},
    },
    {
      tag: "Step 4 of 4 — Forever",
      title: "What happens after year 5?",
      exp: "A company doesn't stop in 2030 — the 'terminal value' captures everything beyond. Keep terminal growth at or below long-run GDP (~2–3%), or the math quietly assumes the company outgrows the world economy.",
      body: (
        <>
          <div className="sliderline">
            <input type="range" min={0} max={4} step={0.25} value={+(a.tg * 100).toFixed(2)}
              onChange={(e) => upd({ tg: +e.target.value / 100 })} />
            <div className="bigval serif">{pc(a.tg)}</div>
          </div>
          <div className="suggest">Typical range: <b>2.0–3.0%</b>. This single number usually drives most of the valuation — the Sensitivity tab shows exactly how much.</div>
        </>
      ),
      apply: () => {},
    },
  ];

  const cur = steps[step];
  return (
    <div className="wizard-veil">
      <div className="wizard">
        <div className="step">{cur.tag}</div>
        <h2 className="serif">{cur.title}</h2>
        <p className="exp">{cur.exp}</p>
        {cur.body}
        <div className="row">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>
          )}
          <button
            className="btn"
            onClick={() => {
              cur.apply();
              if (step < steps.length - 1) setStep(step + 1);
              else onDone();
            }}
          >
            {step === 0 ? "Let's go →" : step < steps.length - 1 ? "Next" : "Build my model →"}
          </button>
        </div>
        <div className="row">
          <button className="btn ghost" style={{ borderColor: "transparent" }} onClick={onDone}>
            Skip — use all suggested values
          </button>
        </div>
      </div>
    </div>
  );
}
