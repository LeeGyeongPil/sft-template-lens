import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspectDataset } from "../src/core/inspect";
import { loadBundled } from "../src/core/loaders/bundled";
import type { InspectOptions, Report, SampleResult } from "../src/core/types";

export const root = resolve(import.meta.dirname, "..");
export const readRepo = (path: string): string => readFileSync(resolve(root, path), "utf8");
export const demoText = (): string => readRepo("examples/demo.jsonl");

export const inspectDemo = (template: string, options: InspectOptions = {}): Promise<Report> =>
  inspectDataset(demoText(), loadBundled(template), options);

export const byLine = (report: Report, line: number): SampleResult => {
  const found = report.results.find((r) => r.line === line);
  if (!found) throw new Error(`no result for line ${line}`);
  return found;
};

export const rulesOf = (r: SampleResult): string[] => r.issues.map((i) => i.rule);

/** Decode the trained tokens of a result as text (characters of tokens whose mask is 1, truncation ignored). */
export function trainedText(r: SampleResult): string {
  let out = "";
  let prev = 0;
  r.ends.forEach((end, k) => {
    if (r.mask[k] === 1 && end > prev) out += r.text!.slice(prev, end);
    prev = end;
  });
  return out;
}
