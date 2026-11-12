import { useRef, useState, type DragEvent } from "react";
import { BUNDLED_TEMPLATES } from "../../core/loaders/bundled";
import { useLang } from "../lang";

interface Props {
  template: string;
  maxSeqLen: number;
  date: string;
  busy: string | null;
  customLabel: string | null;
  onFile: (file: File) => void;
  onTemplate: (name: string) => void;
  onHub: (id: string) => void;
  onLocalFiles: (files: File[]) => void;
  onMax: (n: number) => void;
  onDate: (d: string) => void;
}

/** Inputs: JSONL drop zone, template source (bundled, hub id, local files), max length slider, fixed date. */
export function SourcePanel(p: Props) {
  const { m } = useLang();
  const [hubId, setHubId] = useState("Qwen/Qwen2.5-0.5B-Instruct");
  const fileInput = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) p.onFile(f);
  };
  return (
    <section className="panel source">
      <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => fileInput.current?.click()}>
        {m.dropHint}
        <input ref={fileInput} type="file" accept=".jsonl,.json,.txt" hidden onChange={(e) => e.target.files?.[0] && p.onFile(e.target.files[0])} />
      </div>
      <div className="row">
        <label>
          {m.bundledTemplate}{" "}
          <select value={p.customLabel ? "" : p.template} onChange={(e) => p.onTemplate(e.target.value)} aria-label={m.bundledTemplate}>
            {p.customLabel && <option value="">{p.customLabel}</option>}
            {Object.entries(BUNDLED_TEMPLATES).map(([id, t]) => (
              <option key={id} value={id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          {m.hubModelId}{" "}
          <input value={hubId} onChange={(e) => setHubId(e.target.value)} aria-label={m.hubModelId} size={30} />
        </label>
        <button onClick={() => p.onHub(hubId)}>{m.fetchHub}</button>
        <label className="filebtn">
          {m.localFiles}
          <input type="file" multiple hidden onChange={(e) => e.target.files && p.onLocalFiles([...e.target.files])} />
        </label>
      </div>
      <div className="row">
        <label>
          max_seq_length {p.maxSeqLen}{" "}
          <input type="range" min={64} max={8192} step={64} value={p.maxSeqLen} onChange={(e) => p.onMax(Number(e.target.value))} aria-label="max_seq_length" />
        </label>
        <label>
          {m.fixedDate}{" "}
          <input value={p.date} onChange={(e) => p.onDate(e.target.value)} aria-label={m.fixedDate} size={10} />
        </label>
        {p.busy && <span className="busy">{p.busy}</span>}
      </div>
    </section>
  );
}
