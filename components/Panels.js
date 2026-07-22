"use client";
import { Card, Learn } from "./ui";
import Term from "./Term";
import { fm, f0, pc, px, mx, big } from "@/lib/format";
import {
  RevFcfChart, FootballField, Waterfall, Tornado, ScenarioPaths, DebtPaydown, PremiumBars,
} from "./Charts";

const FYRS = (n = 5) => Array.from({ length: n }, (_, i) => "Year " + (i + 1));

/* ============ OVERVIEW ============ */
export function Overview({ state, R, cur }) {
  const d = R.base.dcf, f = R.base.f, h = state.hist;
  const [b, bl, br] = R.scenarios.map((s) => s.dcf.perShare);
  const range = (h.range || "").split("-").map(Number);
  const items = [
    Number.isFinite(range[0]) && { name: "52-week range", lo: range[0], hi: range[1] },
    { name: "DCF — Gordon growth", lo: Math.min(b, d.perShareExit), hi: Math.max(b, d.perShareExit) },
    { name: "Scenarios Bear→Bull", lo: Math.min(br, bl), hi: Math.max(br, bl) },
    { name: "Sensitivity (WACC ±0.5%)", lo: sensRange(R.sensTg, -1), hi: sensRange(R.sensTg, 1) },
  ].filter(Boolean);
  const gap = Math.abs(d.upside);
  const dir = d.upside >= 0 ? "below" : "above";
  const takeaway =
    gap < 0.1
      ? `On the Base case, ${h.name} is trading roughly in line with what this model works out — about ${pc(Math.abs(d.upside), 0)} ${dir} fair value.`
      : `On the Base case, ${h.name}'s price sits about ${pc(gap, 0)} ${dir} what this model works out. Whether that's a bargain, a warning, or the market seeing something the last three years don't, is the interesting part.`;
  const co = state.co || {};
  const rev = R.reverse;
  return (
    <>
      {(co.description || co.sector) && (
        <Card title={h.name} right={`${h.symbol}${co.exchange ? " · " + co.exchange : ""}`}>
          <div className="co-stats">
            {co.sector && <div><span className="smallcaps">Sector</span>{co.sector}</div>}
            {co.industry && <div><span className="smallcaps">Industry</span>{co.industry}</div>}
            {co.marketCap > 0 && <div><span className="smallcaps">Market cap</span>{cur}{big(co.marketCap)}</div>}
            <div><span className="smallcaps">Price</span>{px(h.price, cur)}</div>
            {co.range && <div><span className="smallcaps">52-wk range</span>{co.range.replace("-", " – ")}</div>}
            {co.employees && <div><span className="smallcaps">Employees</span>{Number(co.employees).toLocaleString()}</div>}
          </div>
          {co.description && <p className="co-desc">{co.description.length > 420 ? co.description.slice(0, 420).trim() + "…" : co.description}</p>}
        </Card>
      )}
      <div className="takeaway">{takeaway}</div>
      {rev && (
        <Card title="Reverse DCF — what the price assumes" right="the market's implied bet">
          <div className="rev-big">
            The current price implies revenue growing about{" "}
            <b className={rev.impliedGrowth >= (rev.histG ?? 0) ? "neg" : "pos"}>{pc(rev.impliedGrowth, 1)}</b> a year for the next five years.
          </div>
          <table className="fin" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Growth the price implies</td><td className="bold">{pc(rev.impliedGrowth, 1)}{rev.capped === "high" ? "+" : ""}</td></tr>
              {rev.histG != null && <tr><td>Growth over the last 3 years</td><td>{pc(rev.histG, 1)}</td></tr>}
              <tr><td>Your Base-case growth</td><td>{pc(rev.baseG, 1)}</td></tr>
            </tbody>
          </table>
          <Learn>
            This flips the DCF around: instead of guessing growth, it asks what growth today's buyers must believe in.
            If that number looks far above what the company has ever done, the market is paying for a story — decide for yourself if you buy it.
          </Learn>
        </Card>
      )}
      {d.upside < -0.4 && (
        <div className="learn" style={{ borderLeftColor: "#b3372b", background: "#fbf1ef" }}>
          🔭 <b>Story-stock alert:</b> the market is paying far more than this company's last three years justify.
          That usually means investors are pricing businesses that aren't in the historicals yet — new products,
          new markets, a turnaround. This isn't a "sell" signal; it's a question. Try the reverse-DCF trick:
          open the Bull case in Model Controls and find the growth + margins needed to reach today's price.
          Whatever you had to type in — <i>that</i> is what buyers at this price must believe.
        </div>
      )}
      {d.upside > 0.6 && (
        <div className="learn" style={{ borderLeftColor: "#1a7a4a", background: "#eff7f1" }}>
          🧐 <b>Too-cheap-to-be-true check:</b> the model sees far more value than the market. Before celebrating,
          ask why: is one unusually good year inflating the margins? Unusual debt or cash items? Markets are
          sometimes wrong — but when something looks this cheap, they usually know something the historicals
          don't show yet. Stress the Bear case before trusting the Bull.
        </div>
      )}
      <div className="two-col">
        <Card title="Valuation summary — football field" right="all methods, one picture">
          <Learn>
            The chart bankers put on page one of every pitch book: each bar is a valuation method's range,
            the dashed line is today's price. If the price sits left of most bars, the model says undervalued.
          </Learn>
          <FootballField items={items} price={h.price} cur={cur} />
        </Card>
        <Card title="Verdict" right={state.hist.symbol}>
          <table className="fin">
            <tbody>
              <tr><td>DCF value / share</td><td className="bold">{px(d.perShare, cur)}</td></tr>
              <tr><td>Current price</td><td>{px(h.price, cur)}</td></tr>
              <tr className="bold"><td>Upside / (downside)</td><td className={d.upside >= 0 ? "pos" : "neg"}>{pc(d.upside)}</td></tr>
              <tr><td><Term term="WACC" /></td><td>{pc(d.wacc, 2)}</td></tr>
              <tr><td><Term term="Enterprise value" /></td><td>{f0(d.ev)}</td></tr>
              <tr><td>% of value in <Term term="Terminal value">terminal value</Term></td><td>{pc(d.tvPct)}</td></tr>
              <tr><td>Bear / Bull per share</td><td>{px(br, cur)} / {px(bl, cur)}</td></tr>
            </tbody>
          </table>
          <Learn>If even the Bear case beats today's price, that's a margin of safety. If only Bull works, you're paying for perfection.</Learn>
        </Card>
      </div>
      <Card title="Operating forecast" right="$ millions">
        <RevFcfChart f={f} years={FYRS()} />
      </Card>
    </>
  );
}
const sensRange = (g, dir) => {
  const r = dir < 0 ? 4 : 2, vals = g.grid[r].filter((v) => v != null);
  return vals.length ? (dir < 0 ? Math.min(...vals) : Math.max(...vals)) : 0;
};

/* ============ 3-STATEMENT ============ */
export function ThreeStatement({ state, R }) {
  const h = state.hist, f = R.base.f;
  const cols = [...h.years, ...FYRS()];
  const histLen = h.years.length;
  const line = (label, histVals, fcVals, bold = false, d = 0) => (
    <tr className={bold ? "bold" : ""} key={label}>
      <td>{label}</td>
      {histVals.map((v, i) => <td key={"h" + i}>{v == null ? "—" : fm(v, d)}</td>)}
      {fcVals.map((v, i) => <td key={"f" + i}>{v == null ? "—" : fm(v, d)}</td>)}
    </tr>
  );
  const hEbit = h.rev.map((v, i) => v - h.cogs[i] - h.sga[i]);
  const hNi = hEbit.map((v, i) => v - h.intExp[i] + h.intInc[i] - h.tax[i]);
  const none = Array(histLen).fill(null);
  return (
    <Card title="3-Statement Model" right="$ millions · historicals from filings, forecasts from your assumptions">
      <Learn>
        The engine of all finance: income statement (performance) → cash flow (cash reality) → balance sheet (position).
        Watch the Balance check row — 0.0 across every year proves the three statements are correctly linked.
      </Learn>
      <div style={{ overflowX: "auto" }}>
        <table className="fin">
          <thead><tr><th></th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            <tr className="section"><td colSpan={99}>Income statement</td></tr>
            {line("Revenue", h.rev, f.rev, true)}
            {line("Cost of revenue", h.cogs, f.cogs)}
            {line("Operating costs (SG&A, R&D)", h.sga, f.sga)}
            {line("EBIT", hEbit, f.ebit, true)}
            {line("EBITDA", hEbit.map((v, i) => v + h.da[i]), f.ebitda, true)}
            {line("Interest expense", h.intExp, f.intExp)}
            {line("Taxes", h.tax, f.taxes)}
            {line("Net income", hNi, f.ni, true)}
            {line("Diluted shares", h.shares, f.shares)}
            {line("EPS", hNi.map((v, i) => (h.shares[i] ? v / h.shares[i] : null)), f.eps, true, 2)}
            <tr className="section"><td colSpan={99}>Balance sheet</td></tr>
            {line("Cash & investments", h.cash, f.cash)}
            {line("Receivables + inventory + other CA", h.ar.map((v, i) => v + h.inv[i] + h.oca[i]), f.ar.map((v, i) => v + f.inv[i] + f.oca[i]))}
            {line("Net PP&E", h.ppe, f.ppe)}
            {line("Other long-term assets", h.olta, f.olta)}
            {line("TOTAL ASSETS", h.cash.map((v, i) => v + h.ar[i] + h.inv[i] + h.oca[i] + h.ppe[i] + h.olta[i]), f.ta, true)}
            {line("Payables + accrued + other CL", h.ap.map((v, i) => v + h.accr[i] + h.ocl[i]), f.ap.map((v, i) => v + f.accr[i] + f.ocl[i]))}
            {line("Total debt & leases", h.debt, f.debt)}
            {line("Other LT liabilities", h.oltl, f.oltl)}
            {line("Common equity", h.eq, f.eq)}
            {line("Balance check", h.cash.map((v, i) => v + h.ar[i] + h.inv[i] + h.oca[i] + h.ppe[i] + h.olta[i] - (h.ap[i] + h.accr[i] + h.ocl[i] + h.debt[i] + h.oltl[i] + h.eq[i])), f.check, true, 1)}
            <tr className="section"><td colSpan={99}>Cash flow (forecast)</td></tr>
            {line("Net income", none, f.ni)}
            {line("+ D&A + stock comp", none, f.da.map((v, i) => v + f.sbcF[i]))}
            {line("− Increase in working capital", none, f.nwcChg.map((v) => -v))}
            {line("Cash from operations", none, f.cfo, true)}
            {line("− Capex", none, f.capexF.map((v) => -v))}
            {line("Free cash flow", none, f.fcf, true)}
            {line("− Dividends", none, f.divF.map((v) => -v))}
            {line("− Buybacks", none, f.bbF.map((v) => -v))}
            {line("Ending cash", none, f.cash, true)}
          </tbody>
        </table>
      </div>
      <Learn>
        Cash is never assumed — it's the ending balance from the cash-flow statement. Equity rolls forward with
        income and payouts; PP&E rolls forward with capex and depreciation. That interlocking is what "3-statement model" means.
      </Learn>
    </Card>
  );
}

/* ============ DCF ============ */
export function DcfPanel({ state, R, cur }) {
  const d = R.base.dcf, f = R.base.f;
  const steps = [
    { name: "PV of 5-yr FCF", value: d.pvF },
    { name: "PV of terminal value", value: d.pvTV },
    { name: "Enterprise value", isTotal: true },
    { name: "Net debt", value: -d.netDebt },
    { name: "Equity value", isTotal: true },
  ];
  return (
    <>
      <div className="two-col">
        <Card title="From cash flows to a share price" right="the value bridge">
          <Learn>
            A DCF answers one question: what are all future cash flows worth today? Five forecast years,
            plus a terminal value for everything after, discounted at the WACC — then subtract debt to get what shareholders own.
          </Learn>
          <Waterfall steps={steps} cur={cur} />
          <table className="fin">
            <tbody>
              <tr><td>Equity value ÷ {fm(state.hist.shares[state.hist.shares.length - 1], 0)}M shares</td><td className="bold">{px(d.perShare, cur)} / share</td></tr>
              <tr><td>Cross-check — exit multiple TV method</td><td>{px(d.perShareExit, cur)}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="WACC build" right="CAPM">
          <table className="fin">
            <tbody>
              <tr><td>Cost of equity (rf + β·ERP)</td><td>{pc(d.ke, 2)}</td></tr>
              <tr><td>After-tax cost of debt</td><td>{pc(d.kdAT, 2)}</td></tr>
              <tr><td>Equity weight</td><td>{pc(d.we)}</td></tr>
              <tr><td>Debt weight</td><td>{pc(d.wd)}</td></tr>
              <tr className="bold"><td>WACC</td><td>{pc(d.wacc, 2)}</td></tr>
              <tr><td>Terminal value share of EV</td><td>{pc(d.tvPct)}</td></tr>
            </tbody>
          </table>
          <Learn>
            Debt is cheaper than equity (interest is tax-deductible and lenders take less risk), so the blend —
            the WACC — sits between the two. Riskier company → higher beta → higher WACC → lower value today.
          </Learn>
        </Card>
      </div>
      <Card title="What actually moves this valuation — tornado chart" right="one-at-a-time impact on value per share">
        <Learn>
          Analysts' favourite honesty check: wiggle each assumption by a realistic amount and watch the impact.
          The long bars are where your model lives and dies — argue about those, not the short ones.
        </Learn>
        <Tornado t={R.tornado} cur={cur} />
      </Card>
      <Card title="Unlevered free cash flow build" right="$ millions">
        <div style={{ overflowX: "auto" }}>
          <table className="fin">
            <thead><tr><th></th>{FYRS().map((y) => <th key={y}>{y}</th>)}</tr></thead>
            <tbody>
              {[["EBIT", f.ebit], ["− Taxes on EBIT", f.ebit.map((v) => -v * state.asm.taxRate)], ["+ D&A", f.da],
                ["− Capex", f.capexF.map((v) => -v)], ["− Incr. in working capital", f.nwcChg.map((v) => -v)],
                ["Unlevered FCF", f.ufcf, true]].map(([l, vals, b]) => (
                <tr key={l} className={b ? "bold" : ""}><td>{l}</td>{vals.map((v, i) => <td key={i}>{f0(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ============ SCENARIOS ============ */
export function ScenariosPanel({ state, R, cur, scen, setScen }) {
  const names = ["Base", "Bull", "Bear"];
  return (
    <>
      <Card title="Three futures, one model" right="full model re-run per case">
        <Learn>
          One number is a guess; three numbers are a view. The Bull–Bear spread IS your risk.
          Click a column header to make that case drive every other tab.
        </Learn>
        <table className="fin">
          <thead>
            <tr><th></th>{names.map((n, i) => (
              <th key={n} style={{ cursor: "pointer", color: scen === i ? "var(--brown)" : undefined }} onClick={() => setScen(i)}>
                {n}{scen === i ? " ●" : ""}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            <tr><td>Revenue growth</td>{state.asm.growth.map((v, i) => <td key={i}>{pc(v)}</td>)}</tr>
            <tr><td>Gross margin</td>{state.asm.gm.map((v, i) => <td key={i}>{pc(v)}</td>)}</tr>
            <tr><td>Operating costs %</td>{state.asm.sgaPct.map((v, i) => <td key={i}>{pc(v)}</td>)}</tr>
            <tr><td>Year-5 revenue</td>{R.scenarios.map((s, i) => <td key={i}>{f0(s.f.rev[4])}</td>)}</tr>
            <tr><td>Year-5 EBITDA</td>{R.scenarios.map((s, i) => <td key={i}>{f0(s.f.ebitda[4])}</td>)}</tr>
            <tr><td>5-yr cumulative FCF</td>{R.scenarios.map((s, i) => <td key={i}>{f0(s.f.fcf.reduce((a, b) => a + b, 0))}</td>)}</tr>
            <tr className="bold"><td>DCF value / share</td>{R.scenarios.map((s, i) => <td key={i}>{px(s.dcf.perShare, cur)}</td>)}</tr>
            <tr className="bold"><td>Upside / (downside)</td>{R.scenarios.map((s, i) => (
              <td key={i} className={s.dcf.upside >= 0 ? "pos" : "neg"}>{pc(s.dcf.upside)}</td>
            ))}</tr>
          </tbody>
        </table>
      </Card>
      <Card title="Revenue paths" right="$ millions">
        <ScenarioPaths scenarios={R.scenarios} years={FYRS()} histRev={state.hist.rev[state.hist.rev.length - 1]} />
      </Card>
    </>
  );
}

/* ============ SENSITIVITY ============ */
const heatColor = (v, lo, hi) => {
  if (v == null) return "#eee";
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  return `rgb(${Math.round(249 - t * 60)},${Math.round(226 + t * 14)},${Math.round(219 - t * 12)})`;
};
export function SensitivityPanel({ R, cur }) {
  const flat = [...R.sensTg.grid.flat(), ...R.sensExit.grid.flat()].filter((v) => v != null);
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const grid = (G, colFmt, title, note) => (
    <Card title={title} right="value per share">
      <div style={{ overflowX: "auto" }}>
        <table className="heat">
          <thead><tr><th>WACC ↓</th>{G.cols.map((c, i) => <th key={i}>{colFmt(c)}</th>)}</tr></thead>
          <tbody>
            {G.rows.map((w, ri) => (
              <tr key={ri}>
                <th>{pc(w, 2)}</th>
                {G.grid[ri].map((v, ci) => (
                  <td key={ci} className={ri === 3 && ci === 2 ? "base" : ""} style={{ background: heatColor(v, lo, hi) }}>
                    {v == null ? "n/m" : px(v, cur)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Learn>{note}</Learn>
    </Card>
  );
  return (
    <>
      {grid(R.sensTg, (c) => pc(c), "WACC × terminal growth",
        "One row down (WACC +0.5%) and value falls hard — discount rates punish far-future cash flows. The outlined cell is your base case; green = higher value.")}
      {grid(R.sensExit, (c) => mx(c), "WACC × exit EV/EBITDA multiple",
        "The exit-multiple method sidesteps the touchy (WACC − g) math: what would a buyer pay for Year-5 EBITDA? Where both grids agree, your valuation is robust.")}
    </>
  );
}

/* ============ CAPITAL RAISING ============ */
export function CapPanel({ state, R, cur }) {
  const c = R.cap, a = state.asm;
  return (
    <div className="two-col">
      <Card title={`Raising ${f0(a.raiseAmt)} — equity vs. debt`} right="EPS math">
        <Learn>
          Every CFO's dilemma: sell ownership (safe but dilutive) or borrow (cheap but risky).
          Rule of thumb — debt wins on EPS when its after-tax cost {pc(c.kdAT, 1)} is below the earnings yield {pc(c.ey, 1)}.
        </Learn>
        <table className="fin">
          <tbody>
            <tr className="section"><td colSpan={2}>Option A — sell new shares</td></tr>
            <tr><td>New shares at {px(c.issuePx, cur)} ({pc(a.eqDisc, 0)} discount)</td><td>{fm(c.newSh, 1)}M</td></tr>
            <tr><td>Ownership handed to new investors</td><td>{pc(c.ownGiven)}</td></tr>
            <tr className="bold"><td>Pro-forma EPS impact</td><td className={c.eqImpact >= 0 ? "pos" : "neg"}>{pc(c.eqImpact)}</td></tr>
            <tr className="section"><td colSpan={2}>Option B — borrow at {pc(a.newDebtRate, 1)}</td></tr>
            <tr><td>Annual interest</td><td>{f0(c.dbInt)}</td></tr>
            <tr><td>Gross leverage after raise</td><td>{mx(c.grossLev)}</td></tr>
            <tr className="bold"><td>Pro-forma EPS impact</td><td className={c.dbImpact >= 0 ? "pos" : "neg"}>{pc(c.dbImpact)}</td></tr>
          </tbody>
        </table>
      </Card>
      <Card title="Starting point" right="Year-1 forecast">
        <table className="fin">
          <tbody>
            <tr><td>EBITDA</td><td>{f0(c.ebitda)}</td></tr>
            <tr><td>Net income</td><td>{f0(c.ni)}</td></tr>
            <tr><td>EPS</td><td>{px(c.eps, cur)}</td></tr>
            <tr><td>Net leverage today</td><td>{mx(c.netLev)}</td></tr>
            <tr><td>After-tax cost of new debt</td><td>{pc(c.kdAT, 2)}</td></tr>
            <tr><td>Earnings yield</td><td>{pc(c.ey, 2)}</td></tr>
          </tbody>
        </table>
        <Learn>
          EPS isn't everything: equity can never bankrupt you, debt can. Stable-cash-flow businesses
          (utilities, franchises) carry more debt safely; cyclical ones should lean on equity.
        </Learn>
      </Card>
    </div>
  );
}

/* ============ M&A ============ */
export function MaPanel({ state, R, cur }) {
  const x = R.ma, a = state.asm;
  return (
    <>
      <div className="two-col">
        <Card title={`An acquirer buys ${state.hist.name}`} right="accretion / dilution">
          <Learn>
            The board asks one blunt question: does the deal raise or lower our EPS? Buying a higher-P/E target
            with lower-P/E currency dilutes unless synergies close the gap.
          </Learn>
          <table className="fin">
            <tbody>
              <tr><td>Offer: {px(state.hist.price, cur)} + {pc(a.prem, 0)} premium</td><td className="bold">{px(x.offerPx, cur)} / share</td></tr>
              <tr><td>Offer equity value</td><td>{f0(x.tgtEq)}</td></tr>
              <tr><td>+ Net debt = transaction EV</td><td>{f0(x.tev)}</td></tr>
              <tr><td>Implied EV / LTM EBITDA</td><td>{mx(x.evEbitda)}</td></tr>
              <tr className="section"><td colSpan={2}>Funding: {pc(a.pctStock, 0)} stock / {pc(1 - a.pctStock, 0)} cash (new debt)</td></tr>
              <tr><td>New acquirer shares</td><td>{fm(x.newSh, 1)}M</td></tr>
              <tr><td>Interest on acquisition debt</td><td>{f0(x.newInt)}</td></tr>
              <tr className="section"><td colSpan={2}>Verdict</td></tr>
              <tr><td>Pro-forma EPS vs. standalone</td><td>{px(x.pfEPS, cur)} vs. {px(x.acqEPS, cur)}</td></tr>
              <tr className="bold"><td>Accretion / (dilution)</td><td className={x.accr >= 0 ? "pos" : "neg"}>{pc(x.accr)}</td></tr>
              <tr><td>Goodwill created</td><td>{f0(x.goodwill)}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="Accretion vs. premium paid" right="the cost of winning">
          <PremiumBars premSens={x.premSens} />
          <Learn>
            Watch accretion die as the premium climbs — every extra 5% of "winning the deal" is paid by the
            acquirer's shareholders. This chart is why bidding wars destroy value.
          </Learn>
          <table className="fin">
            <tbody>
              <tr><td>Acquirer P/E (edit in Model Controls)</td><td>{mx(x.acqPE)}</td></tr>
              <tr><td>Target P/E at offer</td><td>{mx(x.tgtNI > 0 ? x.tgtEq / x.tgtNI : 0)}</td></tr>
              <tr><td>After-tax synergies</td><td>{f0(x.synAT)}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

/* ============ LBO ============ */
export function LboPanel({ state, R, cur }) {
  const l = R.lbo, a = state.asm;
  return (
    <>
      <div className="two-col">
        <Card title={`Private equity takes ${state.hist.symbol} private`} right="returns math">
          <Learn>
            An LBO is buying a house with a big mortgage: small down-payment (sponsor equity), big loan,
            and the company's own cash flow pays the mortgage. PE hurdle: ~2.0x money multiple / ~20% IRR over 5 years.
          </Learn>
          <table className="fin">
            <tbody>
              <tr><td>LTM EBITDA × {mx(a.lboEntry)} entry</td><td className="bold">{f0(l.ev)} EV</td></tr>
              <tr><td>+ Fees</td><td>{f0(l.fees)}</td></tr>
              <tr><td>New debt ({mx(a.lboLev)} EBITDA)</td><td>{f0(l.debt0)}</td></tr>
              <tr className="bold"><td>Sponsor equity check</td><td>{f0(l.sponsor)}</td></tr>
              <tr className="section"><td colSpan={2}>Exit — Year 5 at {mx(a.lboExit)}</td></tr>
              <tr><td>Exit EV</td><td>{f0(l.exitEV)}</td></tr>
              <tr><td>− Remaining debt + cash</td><td>{f0(-l.yrs[4].end + l.yrs[4].cashAcc)}</td></tr>
              <tr className="bold"><td>Equity at exit</td><td>{f0(l.exitEq)}</td></tr>
              <tr className="bold"><td>Money multiple / IRR</td><td>{l.mom.toFixed(2)}x / {pc(l.irr)}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="Debt melts, equity grows" right="the LBO engine">
          <DebtPaydown lbo={l} years={FYRS()} />
          <Learn>
            Every spare dollar "sweeps" to repay debt — each repaid dollar transfers value from lenders to the
            sponsor. Only three sources of LBO return exist: EBITDA growth, debt paydown, multiple expansion.
          </Learn>
        </Card>
      </div>
      <Card title="Debt schedule" right="$ millions">
        <div style={{ overflowX: "auto" }}>
          <table className="fin">
            <thead><tr><th></th>{FYRS().map((y) => <th key={y}>{y}</th>)}</tr></thead>
            <tbody>
              {[["EBITDA", l.yrs.map((y) => y.ebitda)], ["− Interest", l.yrs.map((y) => -y.int_)],
                ["Net income", l.yrs.map((y) => y.ni)], ["FCF for paydown", l.yrs.map((y) => y.fcf), true],
                ["Beginning debt", l.yrs.map((y) => y.beg)], ["Ending debt", l.yrs.map((y) => y.end), true]].map(([lb, vals, b]) => (
                <tr key={lb} className={b ? "bold" : ""}><td>{lb}</td>{vals.map((v, i) => <td key={i}>{f0(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
