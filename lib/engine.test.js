import { describe, it, expect } from "vitest";
import { deriveState, runModel, runAll, reverseDCF, fundamentals } from "./engine.js";
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

describe("engine — fundamentals (funded growth)", () => {
  const F = fundamentals(state, 0.05);
  it("computes ROIC, reinvestment rate and funded growth", () => {
    expect(F).not.toBeNull();
    expect(F.roic).toBeGreaterThan(0);
    expect(Number.isFinite(F.reinvestRate)).toBe(true);
    // the identity that makes the whole check work
    expect(F.fundedGrowth).toBeCloseTo(F.reinvestRate * F.roic, 10);
  });
  it("derives invested capital as debt + equity − cash", () => {
    const L = state.hist.rev.length - 1;
    expect(F.investedCapital).toBeCloseTo(state.hist.debt[L] + state.hist.eq[L] - state.hist.cash[L], 6);
  });
  it("required reinvestment scales with the growth you assume", () => {
    const lo = fundamentals(state, 0.04), hi = fundamentals(state, 0.20);
    expect(hi.requiredRate).toBeGreaterThan(lo.requiredRate);
    expect(hi.requiredRate).toBeCloseTo(0.20 / hi.roic, 10);
  });
  it("flags growth the company cannot fund from its own profits", () => {
    const absurd = fundamentals(state, 5);        // 500% growth
    expect(absurd.requiredRate).toBeGreaterThan(1);
    expect(absurd.verdict).toBe("unfundable");
  });
  it("calls modest growth supported or conservative", () => {
    const modest = fundamentals(state, Math.max(0, F.fundedGrowth - 0.02));
    expect(["supported", "conservative"]).toContain(modest.verdict);
  });
  it("returns null when the ratio would be meaningless", () => {
    const lossMaking = JSON.parse(JSON.stringify(state));
    lossMaking.hist.cogs = lossMaking.hist.cogs.map((v, i) => v + lossMaking.hist.rev[i]); // force negative EBIT
    expect(fundamentals(lossMaking, 0.05)).toBeNull();
    const netCash = JSON.parse(JSON.stringify(state));
    netCash.hist.cash = netCash.hist.cash.map(() => 1e9);   // cash swamps invested capital
    expect(fundamentals(netCash, 0.05)).toBeNull();
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
