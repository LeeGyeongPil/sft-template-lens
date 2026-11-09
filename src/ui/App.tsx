import { useEffect, useMemo, useRef, useState } from "react";
import { cleanJsonl, issuesJsonl } from "../core/export";
import { applyTruncation, DEFAULT_DATE, inspectDataset } from "../core/inspect";
import { BUNDLED_TEMPLATES, DEMO_JSONL, loadBundled } from "../core/loaders/bundled";
import { loadFromFiles } from "../core/loaders/files";
import { loadFromHub } from "../core/loaders/hub";
import type { Report, TemplateBundle } from "../core/types";
import { formatHash, parseHash } from "./hashState";
import { IssueTable } from "./components/IssueTable";
import { LengthHistogram } from "./components/LengthHistogram";
import { SourcePanel } from "./components/SourcePanel";
import { SummaryCards } from "./components/SummaryCards";
import { TokenView } from "./components/TokenView";

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/jsonl" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const initial = useMemo(() => parseHash(window.location.hash), []);
  const [jsonl, setJsonl] = useState(DEMO_JSONL);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [template, setTemplate] = useState(initial.template in BUNDLED_TEMPLATES ? initial.template : "smollm2");
  const [custom, setCustom] = useState<TemplateBundle | null>(null);
  const [max, setMax] = useState(initial.max);
  const [date, setDate] = useState(DEFAULT_DATE);
  const [sample, setSample] = useState(initial.sample);
  const [view, setView] = useState(initial.view);
  const [base, setBase] = useState<Report | null>(null);
  const [busy, setBusy] = useState<string | null>("검사 중…");
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const bundle = useMemo(() => custom ?? loadBundled(template), [custom, template]);

  // Render + tokenize whenever the data, template or date changes. The length slider does not come through here.
  useEffect(() => {
    const id = ++run.current;
    setBusy("검사 중…");
    setError(null);
    inspectDataset(jsonl, bundle, { maxSeqLen: 2048, date }, { onProgress: (d, t) => id === run.current && setBusy(`검사 중… ${d}/${t}`) })
      .then((r) => {
        if (id !== run.current) return;
        setBase(r);
        setBusy(null);
      })
      .catch((e: unknown) => {
        if (id !== run.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setBusy(null);
      });
  }, [jsonl, bundle, date]);

  // Changing max_seq_length only recomputes truncation; nothing is rendered again.
  const report = useMemo(() => (base ? applyTruncation(base, max) : null), [base, max]);

  useEffect(() => {
    window.history.replaceState(null, "", formatHash({ template: custom ? "custom" : template, sample, max, view }));
  }, [template, custom, sample, max, view]);

  const guarded = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const selected = report?.results.find((r) => r.line === sample);

  return (
    <main>
      <header>
        <h1>sft-template-lens</h1>
        <p>학습 전에, 모델의 실제 채팅 템플릿과 토크나이저로 JSONL을 렌더해 학습 토큰(마스크)·잘림·형식 오류를 확인합니다.</p>
      </header>
      {(bundle.mock || usingDemoData) && (
        <div className="mock-banner" role="note">
          연습용 데모(목) 모드 — 번들된 SmolLM2 토크나이저와 샘플 템플릿{usingDemoData ? ", 직접 만든 데모 데이터" : ""}로 동작합니다. 템플릿과 토크나이저 조합이 실제 모델과 다를 수 있습니다. 내 파일을 끌어다 놓으세요.
        </div>
      )}
      <SourcePanel
        template={template}
        maxSeqLen={max}
        date={date}
        busy={busy}
        customLabel={custom ? custom.label : null}
        onFile={(f) =>
          void guarded("파일 읽는 중…", async () => {
            setJsonl(await f.text());
            setUsingDemoData(false);
            setSample(1);
          })
        }
        onTemplate={(name) => {
          setCustom(null);
          setTemplate(name);
        }}
        onHub={(id) => void guarded("허브에서 받는 중… (모델에 따라 수십 초 걸릴 수 있습니다)", async () => setCustom(await loadFromHub(id.trim())))}
        onLocalFiles={(files) => void guarded("파일 읽는 중…", async () => setCustom(await loadFromFiles(files)))}
        onMax={setMax}
        onDate={setDate}
      />
      {error && <div className="error" role="alert">{error}</div>}
      {report && (
        <>
          <SummaryCards report={report} />
          <section className="panel">
            <h2>템플릿 진단</h2>
            <p>
              {report.template.label} · 마스크 방식 {report.template.maskStrategy === "exact-generation" ? "정확(generation 표지)" : "근사(content 위치)"}
            </p>
            {report.template.issues.length === 0 ? <p className="muted">템플릿 수준 경고가 없습니다.</p> : (
              <ul>
                {report.template.issues.map((i, k) => (
                  <li key={k}><span className={`badge ${i.severity}`}>{i.rule}</span> {i.message}</li>
                ))}
              </ul>
            )}
          </section>
          <LengthHistogram report={report} />
          <IssueTable report={report} onSelect={setSample} />
          <TokenView report={report} sample={selected} view={view} onView={setView} />
          <section className="panel toolbar">
            <button onClick={() => download("clean.jsonl", cleanJsonl(report))}>정리 JSONL 내려받기(오류 샘플 제외)</button>
            <button onClick={() => download("issues.jsonl", issuesJsonl(report))}>문제 목록 내려받기</button>
          </section>
        </>
      )}
    </main>
  );
}
