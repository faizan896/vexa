"use client";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, AreaChart,
  XAxis, YAxis, Tooltip, ReferenceLine, Cell, LabelList, CartesianGrid, Legend,
} from "recharts";
import { f0, px, pc } from "@/lib/format";

// compact axis ticks: 1740000 → "1.7T", 400000 → "400B", 5000 → "5B"
const ct = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "T";
  if (a >= 1e3) return Math.round(v / 1e3) + "B";
  if (a >= 1) return Math.round(v) + "M";
  return "0";
};

// axis/ink read from CSS vars so charts adapt to light & dark; bar colours stay brand
const INK = "var(--c-ink)", GREY = "var(--c-axis)", GRID = "var(--c-grid)";
const PLUM = "#6d6d9c", TAN = "#a1836a", BROWN = "#7a5c46",
  GOOD = "#1f9a58", BAD = "#c9483b", GOLD = "#c19a45";

const tip = { contentStyle: { background: "var(--c-surface)", border: "1px solid var(--line)", color: "var(--c-ink)", fontSize: 12.5, fontFamily: "inherit", borderRadius: 6 }, itemStyle: { color: "var(--c-ink)" }, labelStyle: { color: "var(--c-ink)" } };

/** Revenue bars + FCF line — the classic operating summary chart. */
export function RevFcfChart({ f, years }) {
  const data = years.map((y, i) => ({ name: y, Revenue: Math.round(f.rev[i]), "Free cash flow": Math.round(f.fcf[i]) }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} tickFormatter={ct} width={44} />
        <Tooltip {...tip} formatter={(v) => f0(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Revenue" fill={PLUM} radius={[2, 2, 0, 0]} maxBarSize={46} />
        <Line dataKey="Free cash flow" stroke={BROWN} strokeWidth={2.2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Football field — valuation ranges by method vs. current price. */
export function FootballField({ items, price, cur }) {
  // items: [{name, lo, hi}]
  const data = items.map((d) => ({ name: d.name, base: Math.min(d.lo, d.hi), span: Math.abs(d.hi - d.lo) || 0.01, lo: d.lo, hi: d.hi }));
  return (
    <ResponsiveContainer width="100%" height={items.length * 46 + 40}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 40, left: 10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GREY }} tickFormatter={(v) => px(v, cur)} domain={["auto", "auto"]} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} formatter={(v, n, p) => (n === "span" ? `${px(p.payload.lo, cur)} – ${px(p.payload.hi, cur)}` : null)} labelFormatter={(l) => l} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="span" stackId="a" fill={PLUM} radius={3} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={i % 2 ? TAN : PLUM} />)}
        </Bar>
        <ReferenceLine x={price} stroke={BAD} strokeWidth={2} strokeDasharray="4 3"
          label={{ value: `Price ${px(price, cur)}`, position: "top", fill: BAD, fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Waterfall — EV → equity value bridge. */
export function Waterfall({ steps, cur }) {
  // steps: [{name, value, isTotal}] — running bridge
  let run = 0;
  const data = steps.map((s) => {
    if (s.isTotal) { const d = { name: s.name, base: 0, val: run, total: true, raw: run }; return d; }
    const base = s.value >= 0 ? run : run + s.value;
    run += s.value;
    return { name: s.name, base, val: Math.abs(s.value), total: false, raw: s.value };
  });
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: GREY }} interval={0} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: GREY }} tickFormatter={ct} axisLine={false} tickLine={false} width={44} />
        <Tooltip {...tip} formatter={(v, n, p) => (n === "val" ? f0(p.payload.raw) : null)} />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="val" stackId="w" radius={2} maxBarSize={54}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.total ? BROWN : d.raw >= 0 ? PLUM : BAD} />
          ))}
          <LabelList dataKey="raw" position="top" formatter={ct} style={{ fontSize: 10, fill: INK }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tornado — which assumption moves the valuation most. */
export function Tornado({ t, cur }) {
  const data = t.items.map((i) => ({ name: i.label, lo: Math.min(i.low, i.high), hi: Math.max(i.low, i.high) }))
    .map((d) => ({ ...d, base: d.lo, span: d.hi - d.lo || 0.01 }));
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 40}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 30, left: 10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: GREY }} tickFormatter={(v) => (v >= 0 ? "+" : "") + px(v, cur).replace(cur, cur)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11.5, fill: INK }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} formatter={(v, n, p) => (n === "span" ? `${px(p.payload.lo + t.base, cur)} to ${px(p.payload.hi + t.base, cur)}` : null)} />
        <ReferenceLine x={0} stroke={INK} />
        <Bar dataKey="base" stackId="t" fill="transparent" />
        <Bar dataKey="span" stackId="t" fill={GOLD} radius={2} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Scenario revenue paths. */
export function ScenarioPaths({ scenarios, years, histRev }) {
  const names = ["Base", "Bull", "Bear"], colors = [BROWN, GOOD, BAD];
  const data = years.map((y, i) => ({
    name: y, Base: Math.round(scenarios[0].f.rev[i]), Bull: Math.round(scenarios[1].f.rev[i]), Bear: Math.round(scenarios[2].f.rev[i]),
  }));
  data.unshift({ name: "Latest", Base: Math.round(histRev), Bull: Math.round(histRev), Bear: Math.round(histRev) });
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: GREY }} tickFormatter={ct} axisLine={false} tickLine={false} width={44} />
        <Tooltip {...tip} formatter={f0} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {names.map((n, i) => (
          <Line key={n} dataKey={n} stroke={colors[i]} strokeWidth={n === "Base" ? 2.4 : 1.6} dot={false} strokeDasharray={n === "Base" ? "" : "5 4"} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** LBO debt paydown vs. equity build. */
export function DebtPaydown({ lbo, years }) {
  const data = years.map((y, i) => ({
    name: y,
    Debt: Math.round(lbo.yrs[i].end),
    "Sponsor equity value": Math.round(Math.max(lbo.yrs[i].ebitda * ((lbo.exitEV / lbo.exitEbitda) || 10) - lbo.yrs[i].end + lbo.yrs[i].cashAcc, 0)),
  }));
  data.unshift({ name: "Entry", Debt: Math.round(lbo.debt0), "Sponsor equity value": Math.round(lbo.sponsor) });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: GREY }} tickFormatter={ct} axisLine={false} tickLine={false} width={44} />
        <Tooltip {...tip} formatter={f0} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area dataKey="Debt" stroke={BAD} fill="#f3ded9" strokeWidth={2} />
        <Area dataKey="Sponsor equity value" stroke={GOOD} fill="#dff0e6" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Accretion by premium mini-bars. */
export function PremiumBars({ premSens }) {
  const data = premSens.map((s) => ({ name: pc(s.p, 0), val: +(s.acc * 100).toFixed(2) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: GREY }} tickFormatter={(v) => v + "%"} axisLine={false} tickLine={false} width={44} />
        <Tooltip {...tip} formatter={(v) => v + "%"} />
        <ReferenceLine y={0} stroke={INK} />
        <Bar dataKey="val" radius={2} maxBarSize={40}>
          {data.map((d, i) => <Cell key={i} fill={d.val >= 0 ? GOOD : BAD} />)}
          <LabelList dataKey="val" position="top" formatter={(v) => v + "%"} style={{ fontSize: 10.5 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
