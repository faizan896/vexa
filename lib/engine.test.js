import { describe, it, expect } from "vitest";
import { deriveState, runModel, runAll, reverseDCF, lboModel, capRaise, maModel, sensGrid } from "./engine.js";
import { fm, pc, px, big } from "./format.js";

// ---- synthetic, internally-consistent company (Assets = Liabilities + Equity) ----
const B = 1e6;
function year(y, rev) {
  const cogs = rev * 0.6, gp = rev - cogs, ebit = gp - rev * 0.2;
  return {
    income: {
      fiscalYear: String(y), date: `${y}-12-31`, revenue: rev * B, costOfRevenue: cogs * B,
      grossProfit: gp * B, operatingIncome: ebit * B, interestExpense: 10 * B, interestIncome: 3 * B,
      incomeTaxExpense: ebit * B * 0.21, weightedAverageShsOutDil: 100 * B, weightedAverageShsOut: 100 * B,
    },
    balance: {
      cashAndShortTermInvestments: 200 * B, netReceivables: 80 * B, inventory: 50 * B, totalCurrentAssets: 380 * B,
      propertyPlantEquipmentNet: 300 * B, totalAssets: 900 * B, accountPayables: 60 * B, accruedExpenses: 30 * B,
      totalCurrentLiabilities: 150 * B, shortTermDebt: 20 * B, capitalLeaseObligationsCurrent: 0, totalDebt: 250 * B,
      totalLiabilities: 500 * B, longTermDebt: 230 * B, capitalLeaseObligationsNonCurrent: 0,
      totalStockholdersEquity: 400 * B, minorityInterest: 0,
    },
    cashflow: {
      depreciationAndAmortization: 40 * B, stockBasedCompensation: 15 * B, capitalExpenditure: -50 * B,
      commonDividendsPaid: -20 * B, netCommonStockIssuance: -10 * B,
    },
  };
}
const profile = {
  price: 25, currency: "USD", companyName: "TestCo", symbol: "TEST",
  sector: "Technology", industry: "Software", beta: 1.1, marketCap: 2500 * B, exchange: "NASDAQ",
};
const years = [year(2022, 800), year(2023, 900), year(2024, 1000)];
const data = { profile, income: years.map((y) => y.income), balance: years.map((y) => y.balance), cashflow: years.map((y) => y.cashflow) };
const state = deriveState(data);

describe("engine — deriveState", () => {
  it("maps 3 years and derives sane defaults", () => {
    expect(state.hist.rev.length).toBe(3);
    expect(state.hist.rev[2]).toBeCloseTo(1000, 3);
    expect(state.asm.growth[0]).toBeGreaterThan(0);   // grew 800→1000
    expect(state.asm.gm[0]).toBeCloseTo(0.4, 2);      // 40% gross margin
    expect(state.co.industry).toBe("Software");
  });
});

describe("engine — runModel (DCF identities)", () => {
  const { f, dcf } = runModel(state, 0);
  it("produces a positive, finite valuation", () => {
    expect(Number.isFinite(dcf.perShare)).toBe(true);
    expect(dcf.ev).toBeGreaterThan(0);
    expect(dcf.perShare).toBeGreaterThan(0);
  });
  it("holds the accounting identities exactly", () => {
    expect(dcf.eqV).toBeCloseTo(dcf.ev - dcf.netDebt, 6);           // equity = EV − net debt
    expect(dcf.perShare).toBeCloseTo(dcf.eqV / state.hist.shares.at(-1), 6);
  });
  it("keeps WACC in a sane range", () => {
    expect(dcf.wacc).toBeGreaterThan(0.02);
    expect(dcf.wacc).toBeLessThan(0.30);
    expect(dcf.we + dcf.wd).toBeCloseTo(1, 6);
  });
  it("balance sheet ties out every forecast year", () => {
    const ta = f.ta.at(-1);
    f.check.forEach((c) => expect(Math.abs(c)).toBeLessThan(Math.abs(ta) * 0.02));
  });
});

describe("engine — reverseDCF", () => {
  it("implies a growth rate that reproduces the market price", () => {
    const rv = reverseDCF(state);
    expect(rv).not.toBeNull();
    if (!rv.capped) {
      const test = (g) => runModel({ ...state, asm: { ...state.asm, growth: [g, ...state.asm.growth.slice(1)] } }, 0).dcf.perShare;
      expect(test(rv.impliedGrowth)).toBeCloseTo(state.hist.price, 0);
    }
  });
});

describe("engine — runAll", () => {
  it("returns every analysis section", () => {
    const R = runAll(state, 0);
    for (const k of ["base", "scenarios", "sensTg", "sensExit", "tornado", "cap", "ma", "lbo", "reverse"]) {
      expect(R[k]).toBeDefined();
    }
    expect(R.scenarios.length).toBe(3);
  });
});

describe("engine — lboModel", () => {
  const base = runModel(state, 0);
  const lbo = lboModel(state, base);

  it("keeps sources equal to uses and sweeps cash to debt", () => {
    expect(lbo.debt0 + lbo.sponsor).toBeCloseTo(lbo.uses, 6);
    lbo.yrs.forEach((y) => {
      expect(y.end).toBeCloseTo(y.beg - y.pay + y.draw, 6);
      expect(y.end).toBeGreaterThanOrEqual(0);
    });
    expect(lbo.mom).toBeGreaterThan(0);
  });

  it("funds a cash shortfall with a revolver draw instead of losing it", () => {
    // capex far above EBITDA — every forecast year burns cash
    const burn = { ...state, asm: { ...state.asm, capexPct: 0.5 } };
    const b = lboModel(burn, runModel(burn, 0));
    const totalBurn = b.yrs.reduce((s2, y) => s2 + Math.min(y.fcf, 0), 0);
    expect(totalBurn).toBeLessThan(0);
    expect(b.yrs.reduce((s2, y) => s2 + y.draw, 0)).toBeCloseTo(-totalBurn, 6);
    expect(b.yrs.at(-1).end).toBeGreaterThan(b.debt0);   // debt grew, not shrank
    expect(b.yrs.at(-1).cashAcc).toBe(0);
  });

  it("reports a total loss as −100% IRR, not 0%", () => {
    const bust = { ...state, asm: { ...state.asm, lboEntry: 30, lboExit: 1, lboLev: 6.5 } };
    const b = lboModel(bust, runModel(bust, 0));
    expect(b.exitEq).toBeLessThanOrEqual(0);
    expect(b.irr).toBe(-1);
  });
});

describe("engine — capRaise & maModel", () => {
  const base = runModel(state, 0);

  it("dilutes ownership by exactly the new shares issued", () => {
    const c = capRaise(state, base);
    expect(c.proSh).toBeCloseTo(c.sh + c.newSh, 6);
    expect(c.ownGiven).toBeCloseTo(c.newSh / c.proSh, 6);
    expect(c.issuePx).toBeLessThan(state.hist.price);   // issued at a discount
  });

  it("prices the offer at a premium and ties accretion to pro-forma EPS", () => {
    const m = maModel(state, base);
    expect(m.offerPx).toBeCloseTo(state.hist.price * (1 + state.asm.prem), 6);
    expect(m.pfEPS).toBeCloseTo(m.pfNI / m.pfSh, 6);
    expect(m.accr).toBeCloseTo(m.pfEPS / m.acqEPS - 1, 6);
    expect(m.premSens.length).toBe(5);
    // a richer premium is never more accretive
    m.premSens.slice(1).forEach((s2, i) => expect(s2.acc).toBeLessThanOrEqual(m.premSens[i].acc + 1e-9));
  });
});

describe("engine — sensGrid", () => {
  const base = runModel(state, 0);

  it("falls in value as WACC rises and skips invalid WACC ≤ g cells", () => {
    const g = sensGrid(state, base, "tg");
    expect(g.rows.length).toBe(7);
    expect(g.cols.length).toBe(5);
    g.grid.slice(1).forEach((row, i) => row.forEach((v, j) => {
      const prev = g.grid[i][j];
      if (v !== null && prev !== null) expect(v).toBeLessThan(prev);
    }));
    g.grid.forEach((row, i) => row.forEach((v, j) => {
      if (g.rows[i] <= g.cols[j]) expect(v).toBeNull();
    }));
  });
});

describe("format — guards & output", () => {
  it("handles NaN / null safely", () => {
    expect(fm(NaN)).toBe("—");
    expect(px(null)).toBe("—");
    expect(pc(undefined)).toBe("—");
    expect(big(NaN)).toBe("—");
  });
  it("formats correctly", () => {
    expect(pc(0.1)).toBe("10.0%");
    expect(px(12.5)).toBe("$12.50");
    expect(big(1.5e6)).toBe("1.50T");
    expect(big(2500)).toBe("2.50B");
    expect(fm(-1234, 0)).toBe("(1,234)");   // negatives in accounting parens
  });
});
