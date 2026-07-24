/**
 * Export the live model to a real .xlsx workbook (SheetJS, loaded on demand).
 * All monetary values are in millions of the reporting currency, matching the app.
 */
const r1 = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : v);
const r3 = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 1000) / 1000 : v);

export async function exportModelXlsx(state, R, cur = "$", scenName = "Base") {
  const XLSX = await import("xlsx");
  const h = state.hist, a = state.asm, f = R.base.f, d = R.base.dcf;
  const L = h.rev.length - 1;
  const hy = h.years || [];
  const fy = ["Fcst 1", "Fcst 2", "Fcst 3", "Fcst 4", "Fcst 5"];
  const cols = [...hy, ...fy];

  // hist derived
  const hgp = h.rev.map((v, i) => v - h.cogs[i]);
  const hebit = hgp.map((v, i) => v - h.sga[i]);
  const hebitda = hebit.map((v, i) => v + h.da[i]);
  const hni = h.rev.map((v, i) => (v - h.cogs[i] - h.sga[i] - h.intExp[i] + h.intInc[i] - h.tax[i]));

  const row = (label, hArr, fArr) => [label, ...hArr.map(r1), ...fArr.map(r1)];

  // ---- Income Statement ----
  const is = [
    ["INCOME STATEMENT — figures in " + h.currency + " millions"],
    ["Line item", ...cols],
    row("Revenue", h.rev, f.rev),
    row("Cost of revenue", h.cogs, f.cogs),
    row("Gross profit", hgp, f.gp),
    row("Operating costs (SG&A)", h.sga, f.sga),
    row("EBIT", hebit, f.ebit),
    row("D&A", h.da, f.da),
    row("EBITDA", hebitda, f.ebitda),
    row("Interest expense", h.intExp, f.intExp),
    row("Interest income", h.intInc, f.intInc),
    ["Pre-tax income", ...hebit.map((v, i) => r1(v - h.intExp[i] + h.intInc[i])), ...f.pretax.map(r1)],
    row("Taxes", h.tax, f.taxes),
    row("Net income", hni, f.ni),
    row("Diluted shares", h.shares, f.shares),
    ["EPS", ...hni.map((v, i) => r3(v / (h.shares[i] || 1))), ...f.eps.map(r3)],
  ];

  // ---- Balance Sheet (forecast) ----
  const bsHead = ["Line item", ...fy];
  const frow = (label, arr) => [label, ...arr.map(r1)];
  const bs = [
    ["BALANCE SHEET (forecast) — " + h.currency + " millions"],
    bsHead,
    frow("Cash & investments", f.cash),
    frow("Accounts receivable", f.ar),
    frow("Inventory", f.inv),
    frow("Other current assets", f.oca),
    frow("Total current assets", f.tca),
    frow("PP&E, net", f.ppe),
    frow("Other long-term assets", f.olta),
    frow("Total assets", f.ta),
    [],
    frow("Accounts payable", f.ap),
    frow("Accrued expenses", f.accr),
    frow("Other current liabilities", f.ocl),
    frow("Total debt", f.debt),
    frow("Other long-term liabilities", f.oltl),
    frow("Total liabilities", f.tl),
    frow("Total equity", f.eq),
    frow("Total liabilities + equity", f.tle),
    frow("Balance check (≈0)", f.check),
  ];

  // ---- Cash Flow (forecast) ----
  const cf = [
    ["CASH FLOW (forecast) — " + h.currency + " millions"],
    bsHead,
    frow("Net income", f.ni),
    frow("D&A", f.da),
    frow("Stock-based comp", f.sbcF),
    frow("Change in net working capital", f.nwcChg),
    frow("Cash flow from operations", f.cfo),
    frow("Capital expenditure", f.capexF),
    frow("Free cash flow", f.fcf),
    frow("Unlevered FCF (for DCF)", f.ufcf),
    frow("Dividends", f.divF),
    frow("Buybacks", f.bbF),
  ];

  // ---- DCF ----
  const disc = f.ufcf.map((_, i) => 1 / Math.pow(1 + d.wacc, i + 1));
  const pv = f.ufcf.map((v, i) => v * disc[i]);
  const dcf = [
    ["DISCOUNTED CASH FLOW — " + scenName + " case"],
    [],
    ["Year", ...fy],
    ["Unlevered FCF", ...f.ufcf.map(r1)],
    ["Discount factor", ...disc.map(r3)],
    ["PV of FCF", ...pv.map(r1)],
    [],
    ["WACC", r3(d.wacc)],
    ["Terminal growth", r3(a.tg)],
    ["Sum PV of explicit FCF", r1(d.pvF)],
    ["Terminal value (undiscounted)", r1(d.tv)],
    ["PV of terminal value", r1(d.pvTV)],
    ["Enterprise value", r1(d.ev)],
    ["Less: net debt", r1(d.netDebt)],
    ["Equity value", r1(d.eqV)],
    ["Shares outstanding", r1(h.shares[L])],
    ["Intrinsic value / share (" + cur + ")", r3(d.perShare)],
    ["Current price (" + cur + ")", r3(h.price)],
    ["Upside / (downside)", r3(d.upside)],
    ["Cross-check: exit-multiple value / share", r3(d.perShareExit)],
  ];

  // ---- Assumptions ----
  const asum = [
    ["ASSUMPTIONS — " + scenName + " case"],
    [],
    ["Revenue growth", r3(a.growth[0])],
    ["Gross margin", r3(a.gm[0])],
    ["Operating costs % of revenue", r3(a.sgaPct[0])],
    ["D&A % of revenue", r3(a.daPct)],
    ["Capex % of revenue", r3(a.capexPct)],
    ["Tax rate", r3(a.taxRate)],
    ["Beta", r3(a.beta)],
    ["Risk-free rate", r3(a.rf)],
    ["Equity risk premium", r3(a.erp)],
    ["Cost of debt", r3(a.kd)],
    ["Terminal growth", r3(a.tg)],
    ["Exit EV/EBITDA multiple", r1(a.exitMult)],
  ];

  // ---- Summary ----
  const sum = [
    [h.name + " (" + h.symbol + ") — Vexa valuation"],
    [],
    ["Scenario", scenName + " case DCF"],
    ["Intrinsic value / share (" + cur + ")", r3(d.perShare)],
    ["Current price (" + cur + ")", r3(h.price)],
    ["Upside / (downside)", r3(d.upside)],
    ["Enterprise value (" + h.currency + "M)", r1(d.ev)],
    ["WACC", r3(d.wacc)],
    ["Terminal value % of EV", r3(d.tvPct)],
    [],
    ["Data: Financial Modeling Prep. Educational tool — not investment advice."],
    ["Generated by Vexa · vexa-fazis-projects-f96b2d55.vercel.app"],
  ];

  const wb = XLSX.utils.book_new();
  const add = (name, aoa, wch) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: wch || 34 }, ...cols.map(() => ({ wch: 12 }))];
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Summary", sum, 34);
  add("Income Statement", is, 28);
  add("Balance Sheet", bs, 30);
  add("Cash Flow", cf, 30);
  add("DCF", dcf, 34);
  add("Assumptions", asum, 26);

  const safe = (h.symbol || "model").replace(/[^A-Za-z0-9]/g, "");
  XLSX.writeFile(wb, `Vexa_${safe}_${scenName}.xlsx`);
}
