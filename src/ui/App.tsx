import { useEffect, useMemo, useRef, useState } from "react";
import { cleanJsonl, issuesJsonl } from "../core/export";
import { applyTruncation, DEFAULT_DATE, inspectDataset } from "../core/inspect";
import { BUNDLED_TEMPLATES, DEMO_JSONL, loadBundled } from "../core/loaders/bundled";
import { loadFromFiles } from "../core/loaders/files";
import { loadFromHub } from "../core/loaders/hub";
import type { Report, TemplateBundle } from "../core/types";
import { formatHash, parseHash } from "./hashState";
import { LANGS, localizeError, messages, type Lang, type Messages } from "../i18n";
import { initialLang, LangContext, saveLang } from "./lang";
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

// Progress text is stored as a selector (not a translated string) so a language switch updates it at once.
type Busy = { text: (m: Messages) => string } | null;

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
  const [lang, setLang] = useState<Lang>(initialLang);
  const m = messages(lang);
  const [busy, setBusy] = useState<Busy>({ text: (x) => x.busyChecking });
  // The raw error is kept and translated while rendering, so a language switch also re-translates it.
  const [error, setError] = useState<unknown>(null);
  const run = useRef(0);

  // Keep <html lang> in step with the chosen language and remember the choice.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const chooseLang = (next: Lang) => {
    saveLang(next);
    setLang(next);
  };

  const bundle = useMemo(() => custom ?? loadBundled(template), [custom, template]);

  // Render + tokenize whenever the data, template or date changes. The length slider does not come through here.
  useEffect(() => {
    const id = ++run.current;
    setBusy({ text: (x) => x.busyChecking });
    setError(null);
    inspectDataset(jsonl, bundle, { maxSeqLen: 2048, date }, { onProgress: (d, t) => id === run.current && setBusy({ text: (x) => x.busyProgress(d, t) }) })
      .then((r) => {
        if (id !== run.current) return;
        setBase(r);
        setBusy(null);
      })
      .catch((e: unknown) => {
        if (id !== run.current) return;
        setError(e);
        setBusy(null);
      });
  }, [jsonl, bundle, date]);

  // Changing max_seq_length only recomputes truncation; nothing is rendered again.
  const report = useMemo(() => (base ? applyTruncation(base, max) : null), [base, max]);

  useEffect(() => {
    window.history.replaceState(null, "", formatHash({ template: custom ? "custom" : template, sample, max, view }));
  }, [template, custom, sample, max, view]);

  const guarded = async (label: (x: Messages) => string, job: () => Promise<void>) => {
    setBusy({ text: label });
    try {
      await job();
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };

  const selected = report?.results.find((r) => r.line === sample);

  return (
    <LangContext.Provider value={{ lang, m }}>
    <main>
      <header>
        <h1>sft-template-lens</h1>
        <label className="lang-menu">
          {m.langMenuLabel}{" "}
          <select value={lang} onChange={(e) => chooseLang(e.target.value as Lang)} aria-label={m.langMenuLabel}>
            {LANGS.map((l) => (
              <option key={l} value={l}>{l === "en" ? "English" : "한국어"}</option>
            ))}
          </select>
        </label>
        <p>{m.appIntro}</p>
      </header>
      {(bundle.mock || usingDemoData) && (
        <div className="mock-banner" role="note">
          {m.mockBanner(usingDemoData)}
        </div>
      )}
      <SourcePanel
        template={template}
        maxSeqLen={max}
        date={date}
        busy={busy ? busy.text(m) : null}
        customLabel={custom ? custom.label : null}
        onFile={(f) =>
          void guarded((x) => x.busyReading, async () => {
            setJsonl(await f.text());
            setUsingDemoData(false);
            setSample(1);
          })
        }
        onTemplate={(name) => {
          setCustom(null);
          setTemplate(name);
        }}
        onHub={(id) => void guarded((x) => x.busyHub, async () => setCustom(await loadFromHub(id.trim())))}
        onLocalFiles={(files) => void guarded((x) => x.busyReading, async () => setCustom(await loadFromFiles(files)))}
        onMax={setMax}
        onDate={setDate}
      />
      {error !== null && <div className="error" role="alert">{localizeError(error, m)}</div>}
      {report && (
        <>
          <SummaryCards report={report} />
          <section className="panel">
            <h2>{m.diagTitle}</h2>
            <p>
              {m.diagLine(report.template.label, report.template.maskStrategy === "exact-generation")}
            </p>
            {report.template.issues.length === 0 ? <p className="muted">{m.diagNone}</p> : (
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
            <button onClick={() => download("clean.jsonl", cleanJsonl(report))}>{m.downloadClean}</button>
            <button onClick={() => download("issues.jsonl", issuesJsonl(report))}>{m.downloadIssues}</button>
          </section>
        </>
      )}
    </main>
    </LangContext.Provider>
  );
}
