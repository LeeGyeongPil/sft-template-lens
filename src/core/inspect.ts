import { duplicateIssue, renderErrorIssue, ruleInfo, sampleKey, structureIssues, systemDroppedIssue } from "./checks";
import { mixedFormatIssue, normalizeRow } from "./formats";
import { EMPTY_INPUT_MESSAGE, parseJsonl } from "./jsonl";
import { findSpans, spansToTokenMask } from "./mask";
import { checkPrefixPreserving, probeRender, scanCompatibility, TemplateEngine, usesDate } from "./template";
import { LensTokenizer } from "./tokenize";
import { truncationIssues, truncationStats } from "./truncate";
import type { InspectOptions, Issue, Report, Sample, SampleResult, Summary, TemplateBundle, TemplateInfo } from "./types";

export const DEFAULT_MAX_SEQ_LEN = 2048;
export const DEFAULT_DATE = "2026-01-01";
const TRUNCATION_RULES = new Set(["E004", "E005", "W101"]);
const YIELD_EVERY = 20;

export interface InspectHooks {
  /** Called after every sample so a UI can draw a progress bar. */
  onProgress?: (done: number, total: number) => void;
}

function resolveOptions(options: InspectOptions): Required<InspectOptions> {
  const maxSeqLen = options.maxSeqLen ?? DEFAULT_MAX_SEQ_LEN;
  if (!Number.isInteger(maxSeqLen) || maxSeqLen < 1) {
    throw new Error(`maxSeqLen must be a positive integer, got ${String(maxSeqLen)}.`);
  }
  return { maxSeqLen, date: options.date ?? DEFAULT_DATE };
}

const emptyResult = (line: number, issues: Issue[], sample?: Sample): SampleResult => ({
  line,
  format: sample?.format ?? null,
  messages: sample?.messages ?? [],
  text: null,
  ids: [],
  ends: [],
  mask: [],
  maskValid: false,
  tokenCount: 0,
  trainTokens: 0,
  keptTokens: 0,
  trainTokensAfterTruncation: 0,
  issues,
});

/** Build template-level findings that do not depend on a single sample. */
function templateIssues(engine: TemplateEngine, tokenizer: LensTokenizer, bundle: TemplateBundle, strategy: TemplateInfo["maskStrategy"]): Issue[] {
  const out: Issue[] = [];
  if (usesDate(bundle.template)) {
    out.push({
      rule: "W106",
      severity: "warning",
      line: null,
      message: "The template inserts a date (strftime_now / date_string). A fixed date is used so results are reproducible; set the same date when you train.",
    });
  }
  if (strategy === "approx-content") {
    out.push({
      rule: "W107",
      severity: "warning",
      line: null,
      message: "The template has no {% generation %} markers, so the mask is located by assistant content (approximate). The end-of-turn special token is included.",
    });
  }
  out.push(...scanCompatibility(bundle.template));
  out.push(...checkPrefixPreserving(engine));
  const probe = probeRender(engine);
  if (probe && engine.bosToken && probe.text.startsWith(engine.bosToken) && tokenizer.addsBos) {
    out.push({
      rule: "W105",
      severity: "warning",
      line: null,
      message: `The template already writes ${engine.bosToken} and the tokenizer adds it again when special tokens are enabled. Tokenize rendered text with add_special_tokens=False.`,
    });
  }
  return out;
}

/** Render, tokenize and mask every row of a JSONL text; yields to the event loop every 20 samples. */
export async function inspectDataset(
  jsonl: string,
  bundle: TemplateBundle,
  options: InspectOptions = {},
  hooks: InspectHooks = {},
): Promise<Report> {
  const opts = resolveOptions(options);
  const engine = new TemplateEngine(bundle, opts.date);
  const tokenizer = new LensTokenizer(bundle);
  const specialStrings = tokenizer.specialTokens.map((t) => t.content);
  const strategy = engine.hasGeneration ? "exact-generation" : "approx-content";

  const { rows, issues: parseIssues } = parseJsonl(jsonl);
  if (rows.length === 0 && parseIssues.length === 0) throw new Error(EMPTY_INPUT_MESSAGE);
  const byLine = new Map<number, SampleResult>();
  for (const issue of parseIssues) byLine.set(issue.line!, emptyResult(issue.line!, [issue]));

  const samples: Sample[] = [];
  for (const row of rows) {
    const normalized = normalizeRow(row.value, row.line);
    if ("issue" in normalized) byLine.set(row.line, emptyResult(row.line, [normalized.issue]));
    else samples.push(normalized.sample);
  }

  const firstSeen = new Map<string, number>();
  const total = samples.length;
  for (let i = 0; i < total; i++) {
    const sample = samples[i]!;
    byLine.set(sample.line, inspectSample(sample, engine, tokenizer, specialStrings, firstSeen, opts.maxSeqLen));
    hooks.onProgress?.(i + 1, total);
    if ((i + 1) % YIELD_EVERY === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const results = [...byLine.values()].sort((a, b) => a.line - b.line);
  const info: TemplateInfo = {
    id: bundle.id,
    label: bundle.label,
    mock: bundle.mock,
    source: bundle.source,
    maskStrategy: strategy,
    issues: templateIssues(engine, tokenizer, bundle, strategy),
    specialTokenIds: tokenizer.specialTokens.map((t) => t.id),
  };
  const mixed = mixedFormatIssue(samples.map((s) => s.format));
  return withSummary({ template: info, options: opts, results, datasetIssues: mixed ? [mixed] : [], summary: undefined as unknown as Summary });
}

function inspectSample(
  sample: Sample,
  engine: TemplateEngine,
  tokenizer: LensTokenizer,
  specialStrings: string[],
  firstSeen: Map<string, number>,
  maxSeqLen: number,
): SampleResult {
  const issues: Issue[] = [...structureIssues(sample.line, sample.messages)];
  const key = sampleKey(sample.messages);
  const first = firstSeen.get(key);
  if (first === undefined) firstSeen.set(key, sample.line);
  else issues.push(duplicateIssue(sample.line, first));

  let text: string;
  try {
    text = engine.render(sample.messages);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return emptyResult(sample.line, [...issues, renderErrorIssue(sample.line, reason)], sample);
  }
  const dropped = systemDroppedIssue(sample.line, sample.messages, text);
  if (dropped) issues.push(dropped);

  const { ids, ends } = tokenizer.encode(text);
  const spans = findSpans(engine, sample.messages, text, specialStrings);
  if (spans.issue) issues.push({ ...spans.issue, line: sample.line, message: `Line ${sample.line}: ${spans.issue.message}` });
  const mask = spans.valid ? spansToTokenMask(ends, spans.spans) : new Array<number>(ids.length).fill(0);
  const trainTokens = mask.reduce((a, b) => a + b, 0);

  const result: SampleResult = {
    line: sample.line,
    format: sample.format,
    messages: sample.messages,
    text,
    ids,
    ends,
    mask,
    maskValid: spans.valid,
    tokenCount: ids.length,
    trainTokens,
    keptTokens: 0,
    trainTokensAfterTruncation: 0,
    issues,
  };
  return applyToSample(result, maxSeqLen);
}

/** (Re)compute the truncation-dependent fields and issues of one sample. */
function applyToSample(result: SampleResult, maxSeqLen: number): SampleResult {
  const kept = result.issues.filter((i) => !TRUNCATION_RULES.has(i.rule));
  if (result.text === null || !result.maskValid) return { ...result, issues: kept };
  const { keptTokens, trainAfter } = truncationStats(result.mask, maxSeqLen);
  const extra = truncationIssues(result.line, result.trainTokens, trainAfter, result.tokenCount, maxSeqLen);
  return { ...result, keptTokens, trainTokensAfterTruncation: trainAfter, issues: [...kept, ...extra] };
}

/** Change `max_seq_length` without rendering or tokenizing again (cheap; used by the slider). */
export function applyTruncation(report: Report, maxSeqLen: number): Report {
  const opts = resolveOptions({ ...report.options, maxSeqLen });
  return withSummary({ ...report, options: opts, results: report.results.map((r) => applyToSample(r, opts.maxSeqLen)) });
}

function withSummary(report: Report): Report {
  const ruleCounts: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;
  let samplesWithErrors = 0;
  let zero = 0;
  let trained = 0;
  let kept = 0;
  const count = (issue: Issue): void => {
    ruleCounts[issue.rule] = (ruleCounts[issue.rule] ?? 0) + 1;
    if (issue.severity === "error") errors++;
    else warnings++;
  };
  for (const r of report.results) {
    r.issues.forEach(count);
    if (r.issues.some((i) => i.severity === "error")) samplesWithErrors++;
    if (r.issues.some((i) => i.rule === "E005")) zero++;
    trained += r.trainTokensAfterTruncation;
    kept += r.keptTokens;
  }
  report.template.issues.forEach(count);
  report.datasetIssues.forEach(count);
  const summary: Summary = {
    samples: report.results.length,
    errors,
    warnings,
    samplesWithErrors,
    trainTokenRatio: kept === 0 ? 0 : trained / kept,
    zeroTrainAfterTruncation: zero,
    ruleCounts,
  };
  return { ...report, summary };
}

/** All findings of a report in a flat list, ordered template, dataset, then by line. */
export function allIssues(report: Report): Issue[] {
  const perSample = report.results.flatMap((r) => r.issues);
  return [...report.template.issues, ...report.datasetIssues, ...perSample];
}

export { ruleInfo };
