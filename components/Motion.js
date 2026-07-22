"use client";
import { useEffect, useRef, useState } from "react";

/** Count-up animated number. `format` receives the interpolating value. */
export function AnimatedNumber({ value, format, duration = 650 }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (typeof value !== "number" || isNaN(value)) { setV(value); return; }
    const start = performance.now();
    const a = typeof from.current === "number" ? from.current : value;
    const b = value;
    if (Math.abs(b - a) < 1e-9) { setV(b); from.current = b; return; }
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(v)}</>;
}
