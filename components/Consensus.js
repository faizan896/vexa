"use client";
import { useEffect, useRef, useState } from "react";
import { pc } from "@/lib/format";

const MIN_N = 5;   // below this, a "consensus" would be noise pretending to be signal

function Row({ label, mine, stat, fmt }) {
  if (!stat || stat.n < MIN_N) return null;
  // where the user sits in the distribution
  const lo = stat.min, hi = stat.max, span = hi - lo || 1;
  const posMine = Math.min(100, Math.max(0, ((mine - lo) / span) * 100));
  const posMed = Math.min(100, Math.max(0, ((stat.median - lo) / span) * 100));
  const p25 = Math.min(100, Math.max(0, ((stat.p25 - lo) / span) * 100));
  const p75 = Math.min(100, Math.max(0, ((stat.p75 - lo) / span) * 100));
  const diff = mine - stat.median;
  const word = Math.abs(diff) < 1e-9 ? "in line with" : diff > 0 ? "above" : "below";
  return (
    <div className="cons-row">
      <div className="cons-head">
        <span>{label}</span>
        <span className="cons-med">median {fmt(stat.median)}</span>
      </div>
      <div className="cons-track">
        <span className="cons-iqr" style={{ left: p25 + "%", width: Math.max(2, p75 - p25) + "%" }} />
        <span className="cons-medmark" style={{ left: posMed + "%" }} />
        <span className="cons-you" style={{ left: posMine + "%" }} />
      </div>
      <div className="cons-note">
        You: <b>{fmt(mine)}</b> — {word} the median
      </div>
    </div>
  );
}

/**
 * Shows how this user's assumptions compare with everyone else who modelled the
 * same company. Only submits once the user has actually changed something —
 * otherwise the "consensus" would just echo the filing-derived defaults.
 */
export default function Consensus({ symbol, asm, edited }) {
  const [data, setData] = useState(null);
  const sentRef = useRef(false);
  const timer = useRef(null);

  // read
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`/api/consensus/${encodeURIComponent(symbol)}`);
        const j = await r.json();
        if (!dead) setData(j);
      } catch { /* feature simply stays hidden */ }
    })();
    return () => { dead = true; };
  }, [symbol]);

  // contribute (debounced, once per model per session)
  useEffect(() => {
    if (!edited || sentRef.current || !asm) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const flag = `vexa_cons_${symbol}`;
      try { if (sessionStorage.getItem(flag)) { sentRef.current = true; return; } } catch {}
      sentRef.current = true;
      try {
        await fetch(`/api/consensus/${encodeURIComponent(symbol)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ growth: asm.growth[0], gm: asm.gm[0], tg: asm.tg, beta: asm.beta }),
        });
        try { sessionStorage.setItem(flag, "1"); } catch {}
        const r = await fetch(`/api/consensus/${encodeURIComponent(symbol)}`);
        setData(await r.json());
      } catch { /* ignore */ }
    }, 4000);
    return () => clearTimeout(timer.current);
  }, [edited, asm, symbol]);

  if (!data || !data.n || data.n < MIN_N) return null;
  const p1 = (v) => pc(v, 1);
  const b2 = (v) => v.toFixed(2);

  return (
    <div className="consensus">
      <div className="smallcaps">What others assumed · {data.n} models</div>
      <Row label="Revenue growth" mine={asm.growth[0]} stat={data.growth} fmt={p1} />
      <Row label="Gross margin" mine={asm.gm[0]} stat={data.gm} fmt={p1} />
      <Row label="Terminal growth" mine={asm.tg} stat={data.tg} fmt={p1} />
      <Row label="Beta" mine={asm.beta} stat={data.beta} fmt={b2} />
      <div className="cons-foot">
        Anonymous — only these numbers are stored, never who entered them.
      </div>
    </div>
  );
}
