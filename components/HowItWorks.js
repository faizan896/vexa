"use client";

const STEPS = [
  { n: 1, t: "Search a company", d: "Type a name or ticker. Vexa pulls its last three years of financials from official filings." },
  { n: 2, t: "Answer four questions", d: "About growth, profit, risk and the long run. Each one already has a sensible answer filled in, so you can just adjust it." },
  { n: 3, t: "Read your model", d: "You get the full valuation with charts. Change any number and everything updates." },
];

/** Clean, in-place staggered reveal — no pinning, no empty space. */
export default function HowItWorks() {
  return (
    <section className="lp-band alt reveal" id="how">
      <div className="lp-band-inner">
        <div className="smallcaps center">How it works</div>
        <h2 className="serif center lp-h2">Three steps to a full model.</h2>
        <div className="steps3 lp-steps">
          {STEPS.map((s) => (
            <div className="step3" key={s.n}>
              <div className="n">{s.n}</div>
              <div><b>{s.t}</b><br />{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
