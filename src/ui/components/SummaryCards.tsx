import type { Report } from "../../core/types";
import { useLang } from "../lang";

/** Top row of numbers: how healthy is this dataset for this template and length limit. */
export function SummaryCards({ report }: { report: Report }) {
  const { m } = useLang();
  const s = report.summary;
  const cards: Array<{ label: string; value: string; tone: string }> = [
    { label: m.cardSamples, value: String(s.samples), tone: "" },
    { label: m.cardErrors, value: String(s.errors), tone: s.errors ? "bad" : "good" },
    { label: m.cardWarnings, value: String(s.warnings), tone: s.warnings ? "warn" : "good" },
    { label: m.cardSamplesWithErrors, value: String(s.samplesWithErrors), tone: s.samplesWithErrors ? "bad" : "good" },
    { label: m.cardTrainRatio, value: `${(s.trainTokenRatio * 100).toFixed(1)}%`, tone: "" },
    { label: m.cardZeroAfterTruncation, value: String(s.zeroTrainAfterTruncation), tone: s.zeroTrainAfterTruncation ? "bad" : "good" },
  ];
  return (
    <section className="cards" aria-label={m.summaryAria}>
      {cards.map((c) => (
        <div key={c.label} className={`card ${c.tone}`}>
          <div className="card-value">{c.value}</div>
          <div className="card-label">{c.label}</div>
        </div>
      ))}
    </section>
  );
}
