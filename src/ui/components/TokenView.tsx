import { tokenStarts } from "../../core/tokenize";
import type { Report, SampleResult } from "../../core/types";
import { tokenCount } from "../../i18n";
import { useLang } from "../lang";

const MAX_CHIPS = 3000;

interface Props {
  report: Report;
  sample: SampleResult | undefined;
  view: "tokens" | "text";
  onView: (view: "tokens" | "text") => void;
}

/** Colored token chips: green = trained, gray = masked, hatched = cut by max_seq_length, outlined = special token. */
export function TokenView({ report, sample, view, onView }: Props) {
  const { m } = useLang();
  const special = new Set(report.template.specialTokenIds);
  const exact = report.template.maskStrategy === "exact-generation";
  return (
    <section className="panel">
      <h2>
        {m.tokenViewTitle} {sample ? m.tokenViewLine(sample.line) : ""}{" "}
        <span className={`badge ${exact ? "good" : "warn"}`} title={m.badgeTitle(exact)}>
          {m.badgeMask(exact)}
        </span>
      </h2>
      {!sample && <p className="muted">{m.pickSample}</p>}
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
            <button onClick={() => onView(view === "tokens" ? "text" : "tokens")}>{view === "tokens" ? m.viewAsText : m.viewAsTokens}</button>
            <span className="muted">
              {m.tokenStats(tokenCount(m, sample.tokenCount), sample.trainTokens, sample.trainTokensAfterTruncation)}
            </span>
          </div>
          <div className="legend">
            <span className="chip train">{m.legendTrain}</span> <span className="chip masked">{m.legendMasked}</span> <span className="chip cut">{m.legendCut}</span> <span className="chip special">{m.legendSpecial}</span>
          </div>
          {!sample.maskValid && <p className="warn-text">{m.maskFailed}</p>}
          {view === "text" ? (
            <pre className="rendered">{sample.text}</pre>
          ) : (
            <div className="tokens" data-testid="tokens">
              {renderChips(sample, special, report.options.maxSeqLen, m.moreChips)}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function renderChips(sample: SampleResult, special: Set<number>, maxSeqLen: number, moreChips: (n: number) => string) {
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
  if (sample.ends.length > limit) chips.push(<span key="more" className="muted">{moreChips(sample.ends.length - limit)}</span>);
  return chips;
}
