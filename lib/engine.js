/**
 * Vexa compute engine.
 * Pure functions — no React, no API. All monetary values in millions.
 * Ported from a validated Excel model (balance checks tie to 0 by construction).
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Map FMP statements (already scaled to $M) + profile into engine inputs + derived default assumptions. */
export function deriveState(data) {
  const { profile, income, balance, cashflow } = data; // arrays oldest->latest (len<=3)
  const L = income.length - 1;
  const M = 1e6;
  const s = (v) => (v || 0) / M;

  const hist = {
    years: income.map((r) => "FY" + (r.fiscalYear || (r.date || "").slice(0, 4))),
    rev: income.map((r) => s(r.revenue)),
    cogs: income.map((r) => s(r.costOfRevenue)),
    sga: income.map((r) => s(r.grossProfit - r.operatingIncome)), // total opex below GP
    da: cashflow.map((r) => s(r.depreciationAndAmortization)),
    intExp: income.map((r) => s(r.interestExpense)),
    intInc: income.map((r) => s(r.interestIncome)),
    tax: income.map((r) => s(r.incomeTaxExpense)),
    shares: income.map((r) => s(r.weightedAverageShsOutDil || r.weightedAverageShsOut)),
    // balance sheet — residual groupings guarantee A − L − E = 0
    cash: balance.map((r) => s(r.cashAndShortTermInvestments || r.cashAndCashEquivalents)),
    ar: balance.map((r) => s(r.netReceivables)),
    inv: balance.map((r) => s(r.inventory)),
    oca: balance.map((r) => s(r.totalCurrentAssets - (r.cashAndShortTermInvestments || r.cashAndCashEquivalents || 0) - (r.netReceivables || 0) - (r.inventory || 0))),
    ppe: balance.map((r) => s(r.propertyPlantEquipmentNet)),
    olta: balance.map((r) => s(r.totalAssets - r.totalCurrentAssets - (r.propertyPlantEquipmentNet || 0))),
    ap: balance.map((r) => s(r.accountPayables)),
    accr: balance.map((r) => s(r.accruedExpenses)),
    ocl: balance.map((r) => s(r.totalCurrentLiabilities - (r.accountPayables || 0) - (r.accruedExpenses || 0) - (r.shortTermDebt || 0) - (r.capitalLeaseObligationsCurrent || 0))),
    debt: balance.map((r) => s(r.totalDebt)),
    oltl: balance.map((r) => s(r.totalLiabilities - r.totalCurrentLiabilities - (r.longTermDebt || 0) - (r.capitalLeaseObligationsNonCurrent || 0))),
    eq: balance.map((r) => s((r.totalStockholdersEquity || 0) + (r.minorityInterest || 0))),
    sbc: cashflow.map((r) => s(r.stockBasedCompensation)),
    capex: cashflow.map((r) => Math.abs(s(r.capitalExpenditure))),
    div: cashflow.map((r) => Math.abs(s(r.commonDividendsPaid || r.netDividendsPaid))),
    bb: cashflow.map((r) => Math.max(0, -s(r.netCommonStockIssuance))),
    price: profile.price || 0,
    currency: profile.currency || "USD",
    name: profile.companyName || profile.symbol,
    symbol: profile.symbol,
    range: profile.range || "",
    sector: profile.sector || "",
    image: profile.image || "",
  };

  // company context for the overview panel
  const co = {
    description: profile.description || "",
    sector: profile.sector || "",
    industry: profile.industry || "",
    ceo: profile.ceo || "",
    employees: profile.fullTimeEmployees || "",
    exchange: profile.exchange || profile.exchangeFullName || "",
    country: profile.country || "",
    website: profile.website || "",
    marketCap: (profile.marketCap || 0) / 1e6,
    ipoDate: profile.ipoDate || "",
  };

  // Fix short-term debt double count inside ocl grouping: debt line = totalDebt (ST+LT+leases),
  // so current portion must NOT also sit inside TCL residual — handled above by subtracting it.

  const rev = hist.rev, n = rev.length;
  const cagr = n >= 2 && rev[0] > 0 ? Math.pow(rev[n - 1] / rev[0], 1 / (n - 1)) - 1 : 0.05;
  const g = clamp(cagr, -0.05, 0.25);
  const gm = hist.rev[L] > 0 ? clamp(1 - hist.cogs[L] / hist.rev[L], 0.05, 0.95) : 0.4;
  const sgaPct = hist.rev[L] > 0 ? clamp(hist.sga[L] / hist.rev[L], 0.02, 0.8) : 0.25;
  const pct = (num, den, def, lo = 0, hi = 1) => (den > 0 ? clamp(num / den, lo, hi) : def);
  const taxRate = pct(hist.tax[L], hist.rev[L] - hist.cogs[L] - hist.sga[L] - hist.intExp[L] + hist.intInc[L], 0.21, 0, 0.35);
  const debtRate = hist.debt[L] > 0 && hist.intExp[L] > 0 ? clamp(hist.intExp[L] / hist.debt[L], 0.01, 0.12) : 0.04;

  const ebitdaL = hist.rev[L] - hist.cogs[L] - hist.sga[L] + hist.da[L];
  const mktCap = hist.shares[L] * hist.price;
  const netDebt = hist.debt[L] - hist.cash[L];
  const evMult = ebitdaL > 0 ? clamp((mktCap + netDebt) / ebitdaL, 5, 25) : 12;
  const tgtNI = Math.max(hist.rev[L] * 0.08, (hist.rev[L] - hist.cogs[L] - hist.sga[L]) * (1 - taxRate));

  const asm = {
    growth: [g, clamp(g + 0.03, -0.05, 0.30), clamp(g - 0.03, -0.10, 0.25)],
    gm: [gm, clamp(gm + 0.015, 0, 0.97), clamp(gm - 0.02, 0, 0.95)],
    sgaPct: [sgaPct, clamp(sgaPct - 0.01, 0.01, 0.85), clamp(sgaPct + 0.01, 0.02, 0.9)],
    daPct: pct(hist.da[L], hist.rev[L], 0.03, 0, 0.3),
    capexPct: pct(hist.capex[L], hist.rev[L], 0.04, 0, 0.4),
    taxRate,
    arPct: pct(hist.ar[L], hist.rev[L], 0.1),
    invPct: pct(hist.inv[L], hist.cogs[L], 0.05),
    ocaPct: pct(Math.max(hist.oca[L], 0), hist.rev[L], 0.03),
    apPct: pct(hist.ap[L], hist.cogs[L], 0.08),
    accrPct: pct(hist.accr[L], hist.rev[L], 0.03),
    oclPct: pct(Math.max(hist.ocl[L], 0), hist.rev[L], 0.05),
    sbcPct: pct(hist.sbc[L], hist.rev[L], 0.01, 0, 0.2),
    divG: 0.05,
    buyback: hist.bb[L],
    debtRate,
    cashRate: 0.02,
    rf: 0.043,
    beta: clamp(profile.beta || 1, 0.3, 2.5),
    erp: 0.05,
    kd: clamp(Math.max(debtRate + 0.015, 0.05), 0.03, 0.15),
    tg: 0.025,
    exitMult: Math.round(evMult),
    raiseAmt: Math.round(hist.rev[L] * 0.2),
    eqDisc: 0.05,
    newDebtRate: 0.065,
    acqNI: Math.round(tgtNI * 4),
    acqSh: 500,
    acqPx: Math.round((tgtNI * 4 * 16) / 500),
    prem: 0.25,
    pctStock: 0.5,
    acqDebtRate: 0.065,
    syn: Math.round(hist.rev[L] * 0.015),
    lboEntry: Math.round(evMult),
    lboExit: Math.round(evMult),
    lboLev: clamp(Math.round(evMult) - 10 > 0 ? 6 : 5, 3, 6.5),
    lboRate: 0.08,
    lboFees: 0.02,
  };

  // data-quality flags surfaced to the user (conservative — only clear gaps).
  // D&A of exactly zero for an operating company almost always means it wasn't
  // reported in the source filing, so we disclose that the model estimates it.
  co.flags = [];
  if (!(hist.da[L] > 0)) co.flags.push("Depreciation & amortization wasn't in the source filing — the model estimates it from revenue.");

  return { hist, asm, co };
}

/** Full 3-statement forecast + DCF for one scenario. */
export function runModel(state, scenIdx) {
  const h = state.hist, a = state.asm, N = 5;
  const g = a.growth[scenIdx], gm = a.gm[scenIdx], sgaPct = a.sgaPct[scenIdx];
  const L = h.rev.length - 1;
  const f = { rev: [], cogs: [], gp: [], sga: [], ebit: [], da: [], ebitda: [], intExp: [], intInc: [], pretax: [], taxes: [], ni: [], shares: [], eps: [],
    ar: [], inv: [], oca: [], tca: [], ppe: [], olta: [], ta: [], ap: [], accr: [], ocl: [], debt: [], oltl: [], tl: [], eq: [], tle: [], check: [], cash: [],
    sbcF: [], nwcChg: [], cfo: [], capexF: [], fcf: [], divF: [], bbF: [], dCash: [], ufcf: [] };
  let pRev = h.rev[L], pCash = h.cash[L], pPpe = h.ppe[L], pEq = h.eq[L], pSh = h.shares[L], pDiv = h.div[L];
  let pAR = h.ar[L], pInv = h.inv[L], pOca = h.oca[L], pAp = h.ap[L], pAccr = h.accr[L], pOcl = h.ocl[L];
  const debt = h.debt[L], olta = h.olta[L], oltl = h.oltl[L];

  for (let i = 0; i < N; i++) {
    const rev = pRev * (1 + g), cogs = rev * (1 - gm), gp = rev - cogs, sga = rev * sgaPct, ebit = gp - sga;
    const da = rev * a.daPct, ebitda = ebit + da;
    const intExp = debt * a.debtRate, intInc = pCash * a.cashRate;
    const pretax = ebit - intExp + intInc, taxes = pretax * a.taxRate, ni = pretax - taxes;
    const shares = Math.max(pSh - (h.price > 0 ? a.buyback / h.price : 0), pSh * 0.5);
    const eps = shares > 0 ? ni / shares : 0;
    const ar = rev * a.arPct, inv = cogs * a.invPct, oca = rev * a.ocaPct;
    const capex = rev * a.capexPct, ppe = pPpe + capex - da;
    const ap = cogs * a.apPct, accr = rev * a.accrPct, ocl = rev * a.oclPct;
    const sbc = rev * a.sbcPct, div = pDiv * (1 + a.divG), bb = a.buyback;
    const nwcChg = (ar + inv + oca - (pAR + pInv + pOca)) - ((ap + accr + ocl) - (pAp + pAccr + pOcl));
    const cfo = ni + da + sbc - nwcChg, fcf = cfo - capex;
    const dCash = cfo - capex - div - bb, cash = pCash + dCash;
    const eq = pEq + ni + sbc - div - bb;
    const tca = cash + ar + inv + oca, ta = tca + ppe + olta;
    const tl = ap + accr + ocl + debt + oltl, tle = tl + eq;
    const ufcf = ebit * (1 - a.taxRate) + da - capex - nwcChg;
    const push = { rev, cogs, gp, sga, ebit, da, ebitda, intExp, intInc, pretax, taxes, ni, shares, eps, ar, inv, oca, tca, ppe, ta, ap, accr, ocl, tl, eq, tle, cash, cfo, fcf, nwcChg, ufcf };
    Object.entries(push).forEach(([k, v]) => { if (f[k]) f[k].push(v); });
    f.olta.push(olta); f.debt.push(debt); f.oltl.push(oltl);
    f.sbcF.push(sbc); f.capexF.push(capex); f.divF.push(div); f.bbF.push(bb); f.dCash.push(dCash);
    f.check.push(ta - tle);
    pRev = rev; pCash = cash; pPpe = ppe; pEq = eq; pSh = shares; pDiv = div;
    pAR = ar; pInv = inv; pOca = oca; pAp = ap; pAccr = accr; pOcl = ocl;
  }

  const ke = a.rf + a.beta * a.erp, kdAT = a.kd * (1 - a.taxRate);
  const E = h.shares[L] * h.price, D = h.debt[L];
  const we = E + D > 0 ? E / (E + D) : 1, wd = 1 - we;
  const wacc = we * ke + wd * kdAT;
  const pvF = f.ufcf.reduce((s2, v, i) => s2 + v / Math.pow(1 + wacc, i + 1), 0);
  const tv = wacc > a.tg ? (f.ufcf[4] * (1 + a.tg)) / (wacc - a.tg) : 0;
  const pvTV = tv / Math.pow(1 + wacc, 5);
  const ev = pvF + pvTV, netDebt = h.debt[L] - h.cash[L];
  const eqV = ev - netDebt, perShare = h.shares[L] > 0 ? eqV / h.shares[L] : 0;
  const upside = h.price > 0 ? perShare / h.price - 1 : 0;
  const tvExit = f.ebitda[4] * a.exitMult;
  const perShareExit = h.shares[L] > 0 ? (pvF + tvExit / Math.pow(1 + wacc, 5) - netDebt) / h.shares[L] : 0;
  return { f, dcf: { ke, kdAT, E, D, we, wd, wacc, pvF, tv, pvTV, ev, netDebt, eqV, perShare, upside, tvExit, perShareExit, tvPct: ev > 0 ? pvTV / ev : 0 } };
}

/** Two-way sensitivity grid on per-share value. mode: 'tg' | 'exit' */
export function sensGrid(state, base, mode) {
  const a = state.asm, h = state.hist, L = h.rev.length - 1;
  const u = base.f.ufcf, ebitda5 = base.f.ebitda[4], netDebt = h.debt[L] - h.cash[L], sh = h.shares[L];
  const rows = [], cols = [];
  for (let j = -3; j <= 3; j++) rows.push(base.dcf.wacc + j * 0.005);
  for (let i = -2; i <= 2; i++) cols.push(mode === "tg" ? a.tg + i * 0.005 : Math.max(a.exitMult + i * 2, 1));
  const grid = rows.map((w) => cols.map((c) => {
    const pv = u.reduce((s2, v, i) => s2 + v / Math.pow(1 + w, i + 1), 0);
    let tv;
    if (mode === "tg") { if (w <= c) return null; tv = (u[4] * (1 + c)) / (w - c); } else tv = ebitda5 * c;
    return sh > 0 ? (pv + tv / Math.pow(1 + w, 5) - netDebt) / sh : 0;
  }));
  return { rows, cols, grid };
}

/** Tornado: one-at-a-time impact of key assumptions on DCF per share. */
export function tornado(state, scenIdx) {
  const base = runModel(state, scenIdx).dcf.perShare;
  const tweaks = [
    { key: "growth", label: "Revenue growth ±2pp", lo: -0.02, hi: 0.02, scen: true },
    { key: "gm", label: "Gross margin ±2pp", lo: -0.02, hi: 0.02, scen: true },
    { key: "sgaPct", label: "Operating costs % ±2pp", lo: 0.02, hi: -0.02, scen: true },
    { key: "tg", label: "Terminal growth ±0.5pp", lo: -0.005, hi: 0.005 },
    { key: "beta", label: "Beta ±0.15", lo: 0.15, hi: -0.15 },
    { key: "capexPct", label: "Capex % ±1pp", lo: 0.01, hi: -0.01 },
    { key: "taxRate", label: "Tax rate ±3pp", lo: 0.03, hi: -0.03 },
  ];
  const res = tweaks.map((t) => {
    // cheap targeted clone — runModel never mutates state, so hist can be shared
    const run = (d) => {
      const asm = { ...state.asm };
      if (t.scen) { const arr = [...asm[t.key]]; arr[scenIdx] += d; asm[t.key] = arr; }
      else asm[t.key] = asm[t.key] + d;
      return runModel({ ...state, asm }, scenIdx).dcf.perShare;
    };
    return { label: t.label, low: run(t.lo) - base, high: run(t.hi) - base };
  });
  res.sort((x, y) => Math.abs(y.high - y.low) - Math.abs(x.high - x.low));
  return { base, items: res };
}

export function capRaise(state, base) {
  const a = state.asm, h = state.hist, L = h.rev.length - 1, f = base.f;
  const ebitda = f.ebitda[0], debt = h.debt[L], cash = h.cash[L], ni = f.ni[0], sh = f.shares[0];
  const eps = sh > 0 ? ni / sh : 0;
  const issuePx = h.price * (1 - a.eqDisc), newSh = issuePx > 0 ? a.raiseAmt / issuePx : 0;
  const intOnCash = a.raiseAmt * a.cashRate * (1 - a.taxRate);
  const eqNI = ni + intOnCash, eqEPS = sh + newSh > 0 ? eqNI / (sh + newSh) : 0;
  const dbInt = a.raiseAmt * a.newDebtRate, dbNI = ni - dbInt * (1 - a.taxRate) + intOnCash;
  const dbEPS = sh > 0 ? dbNI / sh : 0;
  return { ebitda, debt, cash, ni, sh, eps,
    netLev: ebitda > 0 ? (debt - cash) / ebitda : 0, issuePx, newSh, proSh: sh + newSh, eqNI, eqEPS,
    eqImpact: eps ? eqEPS / eps - 1 : 0, ownGiven: sh + newSh > 0 ? newSh / (sh + newSh) : 0,
    dbInt, dbNI, dbEPS, dbImpact: eps ? dbEPS / eps - 1 : 0, grossLev: ebitda > 0 ? (debt + a.raiseAmt) / ebitda : 0,
    kdAT: a.newDebtRate * (1 - a.taxRate), ey: h.shares[L] * h.price > 0 ? ni / (h.shares[L] * h.price) : 0 };
}

export function maModel(state, base) {
  const a = state.asm, h = state.hist, L = h.rev.length - 1, f = base.f;
  const offerPx = h.price * (1 + a.prem), tgtEq = offerPx * h.shares[L];
  const netDebt = h.debt[L] - h.cash[L], tev = tgtEq + netDebt;
  const ltmEbitda = h.rev[L] - h.cogs[L] - h.sga[L] + h.da[L];
  const tgtNI = f.ni[0];
  const acqEPS = a.acqSh > 0 ? a.acqNI / a.acqSh : 0, acqPE = acqEPS > 0 ? a.acqPx / acqEPS : 0;
  const stockCons = tgtEq * a.pctStock, newSh = a.acqPx > 0 ? stockCons / a.acqPx : 0;
  const cashCons = tgtEq * (1 - a.pctStock), newInt = cashCons * a.acqDebtRate;
  const synAT = a.syn * (1 - a.taxRate), intAT = newInt * (1 - a.taxRate);
  const pfNI = a.acqNI + tgtNI + synAT - intAT, pfSh = a.acqSh + newSh;
  const pfEPS = pfSh > 0 ? pfNI / pfSh : 0, accr = acqEPS > 0 ? pfEPS / acqEPS - 1 : 0;
  const goodwill = tgtEq - h.eq[L];
  const premSens = [0.15, 0.2, 0.25, 0.3, 0.35].map((p) => {
    const oe = h.price * (1 + p) * h.shares[L];
    const ni2 = a.acqNI + tgtNI + synAT - oe * (1 - a.pctStock) * a.acqDebtRate * (1 - a.taxRate);
    const sh2 = a.acqSh + (a.acqPx > 0 ? (oe * a.pctStock) / a.acqPx : 0);
    return { p, acc: acqEPS > 0 && sh2 > 0 ? ni2 / sh2 / acqEPS - 1 : 0 };
  });
  return { offerPx, tgtEq, netDebt, tev, ltmEbitda, evEbitda: ltmEbitda > 0 ? tev / ltmEbitda : 0, tgtNI, acqEPS, acqPE, stockCons, newSh, cashCons, newInt, synAT, intAT, pfNI, pfSh, pfEPS, accr, goodwill, premSens };
}

export function lboModel(state, base) {
  const a = state.asm, h = state.hist, L = h.rev.length - 1, f = base.f;
  const ltm = h.rev[L] - h.cogs[L] - h.sga[L] + h.da[L];
  const ev = ltm * a.lboEntry, fees = ev * a.lboFees, uses = ev + fees;
  const debt0 = ltm * a.lboLev, sponsor = uses - debt0;
  const yrs = []; let beg = debt0, cashAcc = 0;
  for (let i = 0; i < 5; i++) {
    const ebitda = f.ebitda[i], da = f.da[i], ebit = ebitda - da;
    const int_ = beg * a.lboRate, ebt = ebit - int_;
    const tax = Math.max(ebt, 0) * a.taxRate, ni = ebt - tax;
    const fcf = ni + da - f.capexF[i] - f.nwcChg[i];
    const pay = Math.min(Math.max(fcf, 0), beg);
    const end = beg - pay; cashAcc += Math.max(fcf - beg, 0);
    yrs.push({ ebitda, da, ebit, int_, ebt, tax, ni, fcf, beg, pay, end, cashAcc });
    beg = end;
  }
  const exitEbitda = f.ebitda[4], exitEV = exitEbitda * a.lboExit;
  const exitEq = exitEV - yrs[4].end + yrs[4].cashAcc;
  const mom = sponsor > 0 ? exitEq / sponsor : 0, irr = mom > 0 ? Math.pow(mom, 1 / 5) - 1 : 0;
  return { ltm, ev, fees, uses, debt0, sponsor, yrs, exitEbitda, exitEV, exitEq, mom, irr };
}

/** Reverse DCF — what annual revenue growth does today's price imply? */
export function reverseDCF(state) {
  const price = state.hist.price;
  if (!(price > 0)) return null;
  const test = (g) => {
    const growth = [...state.asm.growth]; growth[0] = g;
    return runModel({ ...state, asm: { ...state.asm, growth } }, 0).dcf.perShare;
  };
  let lo = -0.4, hi = 0.85;
  const plo = test(lo), phi = test(hi);
  const L = state.hist.rev.length - 1;
  const histG = L >= 1 && state.hist.rev[0] > 0 ? Math.pow(state.hist.rev[L] / state.hist.rev[0], 1 / L) - 1 : null;
  if (price <= plo) return { impliedGrowth: lo, capped: "low", histG, baseG: state.asm.growth[0] };
  if (price >= phi) return { impliedGrowth: hi, capped: "high", histG, baseG: state.asm.growth[0] };
  for (let i = 0; i < 44; i++) { const mid = (lo + hi) / 2; if (test(mid) < price) lo = mid; else hi = mid; }
  return { impliedGrowth: (lo + hi) / 2, histG, baseG: state.asm.growth[0] };
}

/** Everything at once (for the dashboard). */
export function runAll(state, scenIdx) {
  const base = runModel(state, scenIdx);
  const scenarios = [0, 1, 2].map((i) => runModel(state, i));
  return {
    base,
    scenarios,
    sensTg: sensGrid(state, base, "tg"),
    sensExit: sensGrid(state, base, "exit"),
    tornado: tornado(state, scenIdx),
    cap: capRaise(state, base),
    ma: maModel(state, base),
    lbo: lboModel(state, base),
    reverse: reverseDCF(state),
  };
}
