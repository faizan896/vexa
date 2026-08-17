"use client";
import { pc, big } from "@/lib/format";
import Term from "@/components/Term";

/**
 * The consistency check most models skip: growth has to be paid for.
 * Shows what growth the company's own capital allocation supports, and what the
 * user's assumed growth would actually require it to reinvest.
 */
export default function FundedGrowth({ F, cur = "$" }) {
  if (!F) return null;
  const { roic, reinvestRate, fundedGrowth, assumedGrowth, requiredRate, verdict } = F;

  const line = {
    supported: {
      cls: "ok",
      text: `Your ${pc(assumedGrowth)} is within what ${pc(reinvestRate)} reinvestment at ${pc(roic)} ROIC supports.`,
    },
    conservative: {
      cls: "ok",
      text: `Conservative — the company's own reinvestment supports about ${pc(fundedGrowth)}, more than you've assumed.`,
    },
    stretch: {
      cls: "warn",
      text: `To grow at ${pc(assumedGrowth)} it would need to reinvest ${pc(requiredRate)} of operating profit — it currently reinvests ${pc(reinvestRate)}.`,
    },
    unfundable: {
      cls: "bad",
      text: `To grow at ${pc(assumedGrowth)} it would need to reinvest ${pc(requiredRate)} of operating profit — more than it earns. Not fundable without raising capital.`,
    },
  }[verdict];

  return (
    <div className={"funded " + line.cls}>
      <div className="smallcaps">Can this growth be funded?</div>
      <div className="funded-eq">
        <span><b>{pc(fundedGrowth)}</b><i>funded growth</i></span>
        <span className="eq">=</span>
        <span><b>{pc(reinvestRate)}</b><i>reinvestment rate</i></span>
        <span className="eq">×</span>
        <span><b>{pc(roic)}</b><i><Term term="ROIC" /></i></span>
      </div>
      <p className="funded-note">{line.text}</p>
      <p className="funded-sub">
        Growth isn&apos;t free — a company has to put capital back in and earn a return on it.
        Reinvestment last year: {cur}{big(F.reinvestment)} of {cur}{big(F.nopat)} after-tax operating profit.
      </p>
    </div>
  );
}
