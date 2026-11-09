import type { Report } from "./types";

/** Clean training JSONL: samples without errors, normalized to `{"messages":[{role,content}]}`. */
export function cleanJsonl(report: Report): string {
  const lines = report.results
    .filter((r) => r.messages.length > 0 && !r.issues.some((i) => i.severity === "error"))
    .map((r) => JSON.stringify({ messages: r.messages }));
  return lines.length ? lines.join("\n") + "\n" : "";
}

/** One JSON object per finding: template-level, dataset-level, then per-line. */
export function issuesJsonl(report: Report): string {
  const all = [...report.template.issues, ...report.datasetIssues, ...report.results.flatMap((r) => r.issues)];
  return all.length ? all.map((i) => JSON.stringify(i)).join("\n") + "\n" : "";
}
