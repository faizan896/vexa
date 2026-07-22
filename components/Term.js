"use client";

const GLOSSARY = {
  DCF: "Discounted Cash Flow — adds up all the cash a company will generate in the future and converts it to what it's worth today.",
  WACC: "Weighted Average Cost of Capital — the blended return investors expect. It's the rate used to discount future cash to today. Higher WACC = lower value now.",
  EBITDA: "Earnings before interest, taxes, depreciation and amortization — a rough measure of operating profit, before financing and accounting effects.",
  EBIT: "Earnings before interest and taxes — operating profit after depreciation.",
  "Terminal value": "The value of all cash flows beyond the forecast period, rolled into one number. It usually makes up most of a DCF.",
  Beta: "How much a stock moves relative to the whole market. Beta of 1 moves with the market; above 1 is more volatile, below 1 is steadier.",
  "Free cash flow": "The cash left over after a company pays its running costs and reinvests in itself — the money truly available to investors.",
  "Unlevered FCF": "Free cash flow before any financing (interest, debt). Used in a DCF so the value doesn't depend on how the company is funded.",
  Accretion: "When a deal raises the buyer's earnings per share. The opposite is dilution (EPS falls).",
  IRR: "Internal Rate of Return — the annual return an investment earns, accounting for when the cash comes in.",
  "Money multiple": "How many times your money you get back. 2.0x means you doubled it.",
  Leverage: "Using borrowed money to boost returns. More leverage amplifies both gains and risk.",
  "Net debt": "Total debt minus cash. What the company would still owe if it used all its cash to pay down debt.",
  "Enterprise value": "The value of the whole business — equity plus debt, minus cash. What it would cost to buy the entire company outright.",
  Goodwill: "The premium a buyer pays above a target's book value — usually for brands, contracts and future potential that don't show up on the balance sheet.",
  Sensitivity: "How much the answer changes when you nudge an assumption. Shows which inputs the valuation really depends on.",
};

export default function Term({ term, children }) {
  const def = GLOSSARY[term];
  if (!def) return <>{children || term}</>;
  return (
    <span className="term" tabIndex={0}>
      {children || term}
      <span className="term-pop">{def}</span>
    </span>
  );
}
