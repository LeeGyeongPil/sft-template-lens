/** URL hash <-> UI state, so a screenshot or a link can point at one template, sample and length limit. */
export interface HashState {
  template: string;
  /** Source line of the selected sample. */
  sample: number;
  max: number;
  view: "tokens" | "text";
}

export const DEFAULT_HASH: HashState = { template: "smollm2", sample: 1, max: 2048, view: "tokens" };

export function parseHash(hash: string): HashState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const num = (key: string, fallback: number): number => {
    const n = Number(params.get(key));
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    template: params.get("template") || DEFAULT_HASH.template,
    sample: num("sample", DEFAULT_HASH.sample),
    max: num("max", DEFAULT_HASH.max),
    view: params.get("view") === "text" ? "text" : "tokens",
  };
}

export function formatHash(state: HashState): string {
  const p = new URLSearchParams({ template: state.template, sample: String(state.sample), max: String(state.max) });
  if (state.view === "text") p.set("view", "text");
  return "#" + p.toString();
}
