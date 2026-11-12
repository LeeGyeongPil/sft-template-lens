import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import pkg from "../../package.json";
import { RULES } from "../core/checks";
import { cleanJsonl, issuesJsonl } from "../core/export";
import { allIssues, DEFAULT_DATE, DEFAULT_MAX_SEQ_LEN, inspectDataset } from "../core/inspect";
import { BUNDLED_IDS, DEMO_JSONL, loadBundled } from "../core/loaders/bundled";
import { loadFromHub } from "../core/loaders/hub";
import type { Report, SampleResult, TemplateBundle } from "../core/types";
import { tokenStarts } from "../core/tokenize";
import { isLang, localizeError, messages, resolveCliLang, ruleLabel, tokenCount, type Lang, type Messages } from "../i18n";
import { loadFromDirectory } from "./dir";

class UsageError extends Error {}

const ANSI = {
  reset: "\x1b[0m",
  green: "\x1b[42;30m",
  gray: "\x1b[90m",
  cut: "\x1b[9;2m",
  special: "\x1b[4m",
};

async function loadBundle(m: Messages, values: { demo?: boolean | undefined; template?: string | undefined; "template-dir"?: string | undefined; model?: string | undefined }): Promise<TemplateBundle> {
  const chosen = [values.demo ? "--demo" : "", values["template-dir"] ? "--template-dir" : "", values.model ? "--model" : ""].filter(Boolean);
  if (chosen.length === 0) {
    throw new UsageError(m.errNoSource);
  }
  if (chosen.length > 1) throw new UsageError(m.errManySources(chosen));
  if (values.template && !values.demo) throw new UsageError(m.errTemplateNeedsDemo);
  if (values.demo) return loadBundled(values.template ?? "smollm2");
  if (values["template-dir"]) return loadFromDirectory(values["template-dir"]);
  return loadFromHub(values.model!);
}

function renderSummary(m: Messages, lang: Lang, report: Report, file: string): string {
  const s = report.summary;
  const lines: string[] = [];
  lines.push(`sft-template-lens ${pkg.version}  ${file}`);
  lines.push(`${m.sumTemplate}: ${report.template.label}`);
  if (report.template.mock) lines.push(m.sumMode);
  lines.push(m.sumMask(report.template.maskStrategy, report.options.maxSeqLen, report.options.date));
  lines.push(m.sumCounts(s.samples, s.errors, s.warnings, s.samplesWithErrors));
  lines.push(m.sumTrainRatio((s.trainTokenRatio * 100).toFixed(1)));
  lines.push("");
  lines.push(m.sumTableHead);
  for (const rule of RULES) {
    const n = s.ruleCounts[rule.id];
    if (n) lines.push(`${rule.id}  ${rule.severity.padEnd(7)}  ${String(n).padStart(5)}  ${ruleLabel(rule, lang)}`);
  }
  if (Object.keys(s.ruleCounts).length === 0) lines.push(m.sumNoFindings);
  const issues = allIssues(report);
  const ordered = [...issues.filter((i) => i.severity === "error"), ...issues.filter((i) => i.severity === "warning")];
  if (ordered.length) {
    lines.push("");
    lines.push(m.sumFindingsHead);
    // Issue.message is machine-oriented output and stays English in every language.
    for (const i of ordered.slice(0, 15)) lines.push(`  ${i.rule} ${i.line === null ? m.sumTemplateTag : m.sumLineTag(i.line)} ${i.message}`);
    if (ordered.length > 15) lines.push(ordered.length === 16 ? m.sumMoreOne : m.sumMore(ordered.length - 15));
  }
  return lines.join("\n");
}

/** ANSI token view: green = trained, gray = masked, struck through = cut by max_seq_len. */
export function renderTokenView(r: SampleResult, maxSeqLen: number, lang: Lang = "en"): string {
  const m = messages(lang);
  if (r.text === null) return m.viewNothing(r.line, r.issues.map((i) => i.rule).join(", "));
  const starts = tokenStarts(r.ends);
  const out: string[] = [];
  r.ends.forEach((end, k) => {
    const piece = r.text!.slice(starts[k]!, end);
    if (k > 0 && r.ends[k] === r.ends[k - 1]) return; // continuation byte of one character
    const shown = piece.replace(/\n/g, "↵\n").replace(/\t/g, "→");
    const cut = k >= maxSeqLen;
    const color = cut ? ANSI.cut : r.mask[k] === 1 && r.maskValid ? ANSI.green : ANSI.gray;
    out.push(`${color}${shown}${ANSI.reset}`);
  });
  const legend = `${ANSI.green}${m.viewLegendTrain}${ANSI.reset} ${ANSI.gray}${m.viewLegendMasked}${ANSI.reset} ${ANSI.cut}${m.viewLegendCut}${ANSI.reset}`;
  return [m.viewHead(r.line, tokenCount(m, r.tokenCount), r.trainTokens, r.trainTokensAfterTruncation), legend, "", out.join(""), ""].join("\n");
}

export async function run(argv: string[], io: { out: (s: string) => void; err: (s: string) => void } = { out: (s) => process.stdout.write(s + "\n"), err: (s) => process.stderr.write(s + "\n") }, env: Record<string, string | undefined> = process.env): Promise<number> {
  // Until --lang is parsed (or when parsing fails) the language comes from the environment.
  let lang: Lang = resolveCliLang(undefined, env);
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        demo: { type: "boolean" },
        template: { type: "string" },
        "template-dir": { type: "string" },
        model: { type: "string" },
        "max-seq-len": { type: "string" },
        date: { type: "string" },
        "fail-on": { type: "string" },
        json: { type: "boolean" },
        show: { type: "string" },
        "out-clean": { type: "string" },
        "out-issues": { type: "string" },
        lang: { type: "string" },
        rules: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
    if (values.lang !== undefined && !isLang(values.lang)) throw new UsageError(messages(lang).errLang(values.lang));
    lang = resolveCliLang(values.lang, env);
    const m = messages(lang);
    if (values.help || argv.length === 0) {
      io.out(m.cliHelp(pkg.version, BUNDLED_IDS.join(", "), DEFAULT_MAX_SEQ_LEN, DEFAULT_DATE));
      return 0;
    }
    if (values.version) {
      io.out(pkg.version);
      return 0;
    }
    if (values.rules) {
      for (const r of RULES) io.out(`${r.id}  ${r.severity.padEnd(7)}  ${ruleLabel(r, lang)}`);
      return 0;
    }
    const [command, file] = positionals;
    if (command !== "check") throw new UsageError(m.errUnknownCommand(command ?? ""));
    if (!file && !values.demo) throw new UsageError(m.errMissingFile);

    const failOn = values["fail-on"] ?? "error";
    if (!["error", "warning", "never"].includes(failOn)) throw new UsageError(m.errFailOn(failOn));
    const maxSeqLen = values["max-seq-len"] === undefined ? DEFAULT_MAX_SEQ_LEN : Number(values["max-seq-len"]);
    if (!Number.isInteger(maxSeqLen) || maxSeqLen < 1) throw new UsageError(m.errMaxSeqLen(String(values["max-seq-len"])));

    let text: string;
    if (file) {
      try {
        text = readFileSync(file, "utf8");
      } catch {
        throw new UsageError(m.errCannotRead(file));
      }
    } else {
      text = DEMO_JSONL;
    }
    const bundle = await loadBundle(m, values);
    const report = await inspectDataset(text, bundle, { maxSeqLen, date: values.date ?? DEFAULT_DATE });

    if (values["out-clean"]) writeFileSync(values["out-clean"], cleanJsonl(report));
    if (values["out-issues"]) writeFileSync(values["out-issues"], issuesJsonl(report));

    if (values.json) {
      const slim = { summary: report.summary, template: { ...report.template, specialTokenIds: undefined }, options: report.options, findings: allIssues(report) };
      io.out(JSON.stringify(slim, null, 2));
    } else {
      io.out(renderSummary(m, lang, report, file ?? m.bundledDemoName));
    }
    if (values.show !== undefined) {
      const line = Number(values.show);
      const sample = report.results.find((r) => r.line === line);
      if (!sample) throw new UsageError(m.errShowLine(values.show, report.results.map((r) => r.line).join(", ")));
      io.out("\n" + renderTokenView(sample, maxSeqLen, lang));
    }

    const hasError = report.summary.errors > 0;
    const hasWarning = report.summary.warnings > 0;
    if (failOn === "error" && hasError) return 1;
    if (failOn === "warning" && (hasError || hasWarning)) return 1;
    return 0;
  } catch (error) {
    // When the option parser itself failed, --lang was never read: look for it in the raw arguments.
    if (!(error instanceof UsageError) && lang === resolveCliLang(undefined, env)) {
      const at = argv.findIndex((a) => a === "--lang" || a.startsWith("--lang="));
      const given = at < 0 ? undefined : argv[at]!.startsWith("--lang=") ? argv[at]!.slice(7) : argv[at + 1];
      if (given !== undefined && isLang(given)) lang = given;
    }
    const m = messages(lang);
    // UsageError texts are already in the chosen language; every other error (core, loaders, parseArgs) is mapped through the message table.
    const message = error instanceof UsageError ? error.message : localizeError(error, m);
    const raw = error instanceof Error ? error.message : String(error);
    io.err(`${m.errorPrefix}: ${message}`);
    if (!(error instanceof UsageError) && /fetch failed/i.test(raw)) io.err(`${m.hintPrefix}: ${m.hintProxy}`);
    return 2;
  }
}

// Closing the pipe early (for example `| head`) is normal for a CLI: stop quietly instead of printing a stack.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw e;
});

process.exitCode = await run(process.argv.slice(2));
