import { tokenStarts } from "../../core/tokenize";
import type { Report, SampleResult } from "../../core/types";

const MAX_CHIPS = 3000;

interface Props {
  report: Report;
  sample: SampleResult | undefined;
  view: "tokens" | "text";
  onView: (view: "tokens" | "text") => void;
}

/** Colored token chips: green = trained, gray = masked, hatched = cut by max_seq_length, outlined = special token. */
export function TokenView({ report, sample, view, onView }: Props) {
  const special = new Set(report.template.specialTokenIds);
  const exact = report.template.maskStrategy === "exact-generation";
  return (
    <section className="panel">
      <h2>
        토큰 보기 {sample ? `(줄 ${sample.line})` : ""}{" "}
        <span className={`badge ${exact ? "good" : "warn"}`} title={exact ? "{% generation %} 표지에서 계산" : "어시스턴트 content 위치로 근사"}>
          마스크 {exact ? "정확" : "근사"}
        </span>
      </h2>
      {!sample && <p className="muted">샘플을 고르세요(문제 표의 줄을 누르거나 해시 sample=번호).</p>}
      {sample && sample.text === null && (
        <ul>
          {sample.issues.map((i, k) => (
            <li key={k}>{i.rule}: {i.message}</li>
          ))}
        </ul>
      )}
      {sample && sample.text !== null && (
        <>
          <div className="toolbar">
            <button onClick={() => onView(view === "tokens" ? "text" : "tokens")}>{view === "tokens" ? "텍스트로 보기" : "토큰으로 보기"}</button>
            <span className="muted">
              토큰 {sample.tokenCount}개 · 학습 {sample.trainTokens}개 · 잘림 후 학습 {sample.trainTokensAfterTruncation}개
            </span>
          </div>
          <div className="legend">
            <span className="chip train">학습</span> <span className="chip masked">마스크</span> <span className="chip cut">잘림</span> <span className="chip special">특수 토큰</span>
          </div>
          {!sample.maskValid && <p className="warn-text">마스크를 계산하지 못했습니다(W111). 색칠은 모두 마스크로 표시됩니다.</p>}
          {view === "text" ? (
            <pre className="rendered">{sample.text}</pre>
          ) : (
            <div className="tokens" data-testid="tokens">
              {renderChips(sample, special, report.options.maxSeqLen)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function renderChips(sample: SampleResult, special: Set<number>, maxSeqLen: number) {
  const starts = tokenStarts(sample.ends);
  const chips = [];
  const limit = Math.min(sample.ends.length, MAX_CHIPS);
  for (let k = 0; k < limit; k++) {
    if (k > 0 && sample.ends[k] === sample.ends[k - 1]) continue; // continuation byte of the same character
    const piece = sample.text!.slice(starts[k], sample.ends[k]);
    const cls = ["chip", k >= maxSeqLen ? "cut" : sample.maskValid && sample.mask[k] === 1 ? "train" : "masked", special.has(sample.ids[k]!) ? "special" : ""].join(" ");
    chips.push(
      <span key={k} className={cls} title={`id ${sample.ids[k]}`}>
        {piece.replace(/\n/g, "↵").replace(/ /g, "·")}
      </span>,
    );
  }
  if (sample.ends.length > limit) chips.push(<span key="more" className="muted"> … 외 {sample.ends.length - limit}개</span>);
  return chips;
}
