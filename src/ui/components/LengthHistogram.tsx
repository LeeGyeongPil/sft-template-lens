import type { Report } from "../../core/types";

const W = 520;
const H = 120;
const BINS = 16;

/** Token length distribution as plain SVG, with the max_seq_length line. */
export function LengthHistogram({ report }: { report: Report }) {
  const lengths = report.results.filter((r) => r.text !== null).map((r) => r.tokenCount);
  const max = report.options.maxSeqLen;
  if (lengths.length === 0) return <section className="panel">길이 분포: 표시할 샘플이 없습니다.</section>;
  const top = Math.max(max, ...lengths) * 1.05;
  const counts = new Array<number>(BINS).fill(0);
  for (const n of lengths) counts[Math.min(BINS - 1, Math.floor((n / top) * BINS))]!++;
  const tallest = Math.max(...counts);
  const bw = W / BINS;
  const maxX = (max / top) * W;
  return (
    <section className="panel">
      <h2>토큰 길이 분포</h2>
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="토큰 길이 히스토그램" className="histogram">
        {counts.map((c, i) => (
          <rect key={i} x={i * bw + 1} y={H - (c / tallest) * (H - 8)} width={bw - 2} height={(c / tallest) * (H - 8)} className={(i + 0.5) * (top / BINS) > max ? "bar over" : "bar"} />
        ))}
        <line x1={maxX} x2={maxX} y1={0} y2={H} className="limit" />
        <text x={maxX > W / 2 ? maxX - 4 : maxX + 4} y={12} textAnchor={maxX > W / 2 ? "end" : "start"} className="limit-label">
          max_seq_length {max}
        </text>
        <text x={0} y={H + 14} className="axis">0</text>
        <text x={W} y={H + 14} textAnchor="end" className="axis">{Math.round(top)} 토큰</text>
      </svg>
    </section>
  );
}
