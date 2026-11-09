import type { Report } from "../../core/types";

/** Top row of numbers: how healthy is this dataset for this template and length limit. */
export function SummaryCards({ report }: { report: Report }) {
  const s = report.summary;
  const cards: Array<{ label: string; value: string; tone: string }> = [
    { label: "샘플 수", value: String(s.samples), tone: "" },
    { label: "오류", value: String(s.errors), tone: s.errors ? "bad" : "good" },
    { label: "경고", value: String(s.warnings), tone: s.warnings ? "warn" : "good" },
    { label: "오류 있는 샘플", value: String(s.samplesWithErrors), tone: s.samplesWithErrors ? "bad" : "good" },
    { label: "학습 토큰 비율", value: `${(s.trainTokenRatio * 100).toFixed(1)}%`, tone: "" },
    { label: "잘림 후 학습 0개", value: String(s.zeroTrainAfterTruncation), tone: s.zeroTrainAfterTruncation ? "bad" : "good" },
  ];
  return (
    <section className="cards" aria-label="요약">
      {cards.map((c) => (
        <div key={c.label} className={`card ${c.tone}`}>
          <div className="card-value">{c.value}</div>
          <div className="card-label">{c.label}</div>
        </div>
      ))}
    </section>
  );
}
