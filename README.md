# Vexa

**Financial modeling for everyone.** Type any listed company — Vexa pulls its real financials and walks you through a full, banker-grade model in minutes. No Excel required.

## What it does

Search a ticker (AAPL, TSLA, DPZ, KO…) and Vexa builds, live in the browser:

- **3-Statement Model** — linked income statement, balance sheet and cash flow, 5-year forecast, with a balance check that ties to zero
- **DCF Valuation** — unlevered FCF, CAPM-based WACC build, Gordon-growth terminal value with exit-multiple cross-check
- **Scenario Analysis** — Base / Bull / Bear, full model re-run per case
- **Sensitivity Analysis** — WACC × terminal-growth and WACC × exit-multiple heatmaps
- **Capital Raising** — equity vs. debt: EPS dilution, ownership given up, leverage impact
- **M&A** — accretion/dilution with premium sensitivity, goodwill, funding mix
- **LBO** — sources & uses, 5-year debt paydown, money multiple and IRR

Plus the charts banks actually use: **football field**, **valuation waterfall**, **tornado chart**, scenario paths and LBO debt-paydown.

## Why it's not just Excel in a browser

- A **guided wizard** asks 4 plain-language questions with data-derived suggestions — the model builds itself behind your answers
- **Learn mode** annotates every screen: what the number is, why it matters, what to argue about
- Every edit re-runs all seven analyses instantly

## Getting started

```bash
npm install
cp .env.example .env.local   # add your free FMP key
npm run dev
```

Get a free API key at [financialmodelingprep.com](https://site.financialmodelingprep.com). The free plan covers US-listed companies (most global giants have a US ticker or ADR — TM, SONY, BABA, SAP…).

## Stack

Next.js 14 (App Router) · React 18 · Recharts · Financial Modeling Prep API (key stays server-side in API routes). Models autosave to the browser (localStorage).

## Disclaimer

Educational tool — not investment advice.
