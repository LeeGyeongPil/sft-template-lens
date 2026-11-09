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
import { loadFromDirectory } from "./dir";

const HELP = `sft-template-lens ${pkg.version}
Render SFT training JSONL with the real chat template and tokenizer, and find loss-mask, truncation and format problems before you train.

Usage
  sft-template-lens check <file.jsonl> (--demo | --template-dir <dir> | --model <owner/name>) [options]

Template source (pick one)
  --demo                 Offline practice (mock) mode: bundled SmolLM2 tokenizer + a bundled template
  --template <name>      Bundled template for --demo: ${BUNDLED_IDS.join(", ")} (default smollm2)
  --template-dir <dir>   Folder with tokenizer.json, tokenizer_config.json and optional chat_template.jinja
  --model <owner/name>   Public Hugging Face model (downloads tokenizer files only; set NODE_USE_ENV_PROXY=1 behind a proxy)

Options
  --max-seq-len <n>      Right-truncation limit in tokens (default ${DEFAULT_MAX_SEQ_LEN})
  --date <YYYY-MM-DD>    Fixed date for templates that print the date (default ${DEFAULT_DATE})
  --fail-on <level>      error (default) | warning | never  -> exit code 1 when findings reach that level
  --json                 Print the summary and findings as JSON
  --show <line>          Print a colored token view of the sample at that source line (green = trained)
  --out-clean <path>     Write samples without errors as {"messages": [...]} JSONL
  --out-issues <path>    Write every finding as JSONL
  --rules                List rule ids and exit
  -h, --help / -v, --version

Exit codes: 0 ok, 1 findings at --fail-on level, 2 usage or loading error.
`;

class UsageError extends Error {}

const ANSI = {
  reset: "\x1b[0m",
  green: "\x1b[42;30m",
  gray: "\x1b[90m",
  cut: "\x1b[9;2m",
  special: "\x1b[4m",
};

async function loadBundle(values: { demo?: boolean | undefined; template?: string | undefined; "template-dir"?: string | undefined; model?: string | undefined }): Promise<TemplateBundle> {
  const chosen = [values.demo ? "--demo" : "", values["template-dir"] ? "--template-dir" : "", values.model ? "--model" : ""].filter(Boolean);
  if (chosen.length === 0) {
    throw new UsageError("Choose where the tokenizer and chat template come from: --demo (offline practice), --template-dir <dir> or --model <owner/name>.");
  }
  if (chosen.length > 1) throw new UsageError(`Use only one template source, got ${chosen.join(" and ")}.`);
  if (values.template && !values.demo) throw new UsageError("--template only works together with --demo.");
  if (values.demo) return loadBundled(values.template ?? "smollm2");
  if (values["template-dir"]) return loadFromDirectory(values["template-dir"]);
  return loadFromHub(values.model!);
}

function renderSummary(report: Report, file: string): string {
  const s = report.summary;
  const lines: string[] = [];
  lines.push(`sft-template-lens ${pkg.version}  ${file}`);
  lines.push(`template: ${report.template.label}`);
  if (report.template.mock) lines.push("mode: practice (mock) - bundled SmolLM2 tokenizer, not the real model of this template");
  lines.push(`mask: ${report.template.maskStrategy}   max_seq_len: ${report.options.maxSeqLen}   date: ${report.options.date}`);
  lines.push(`samples: ${s.samples}   errors: ${s.errors}   warnings: ${s.warnings}   samples with errors: ${s.samplesWithErrors}`);
  lines.push(`trained tokens kept after truncation: ${(s.trainTokenRatio * 100).toFixed(1)}% of kept tokens`);
  lines.push("");
  lines.push("rule  level    count  meaning");
  for (const rule of RULES) {
    const n = s.ruleCounts[rule.id];
    if (n) lines.push(`${rule.id}  ${rule.severity.padEnd(7)}  ${String(n).padStart(5)}  ${rule.en}`);
  }
  if (Object.keys(s.ruleCounts).length === 0) lines.push("(no findings)");
  const issues = allIssues(report);
  const ordered = [...issues.filter((i) => i.severity === "error"), ...issues.filter((i) => i.severity === "warning")];
  if (ordered.length) {
    lines.push("");
    lines.push("findings (errors first, up to 15):");
    for (const i of ordered.slice(0, 15)) lines.push(`  ${i.rule} ${i.line === null ? "[template]" : `[line ${i.line}]`} ${i.message}`);
    if (ordered.length > 15) lines.push(`  ... and ${ordered.length - 15} more (use --json or --out-issues)`);
  }
  return lines.join("\n");
}

/** ANSI token view: green = trained, gray = masked, struck through = cut by max_seq_len. */
export function renderTokenView(r: SampleResult, maxSeqLen: number): string {
  if (r.text === null) return `Line ${r.line}: nothing was rendered (${r.issues.map((i) => i.rule).join(", ")}).`;
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
  const legend = `${ANSI.green} trained ${ANSI.reset} ${ANSI.gray}masked${ANSI.reset} ${ANSI.cut}cut by max_seq_len${ANSI.reset}`;
  return [`Line ${r.line}: ${r.tokenCount} tokens, ${r.trainTokens} trained, ${r.trainTokensAfterTruncation} trained after truncation`, legend, "", out.join(""), ""].join("\n");
}

export async function run(argv: string[], io: { out: (s: string) => void; err: (s: string) => void } = { out: (s) => process.stdout.write(s + "\n"), err: (s) => process.stderr.write(s + "\n") }): Promise<number> {
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
        rules: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
    if (values.help || argv.length === 0) {
      io.out(HELP);
      return 0;
    }
    if (values.version) {
      io.out(pkg.version);
      return 0;
    }
    if (values.rules) {
      for (const r of RULES) io.out(`${r.id}  ${r.severity.padEnd(7)}  ${r.en}`);
      return 0;
    }
    const [command, file] = positionals;
    if (command !== "check") throw new UsageError(`Unknown command "${command ?? ""}". The only command is: check <file.jsonl>. Try --help.`);
    if (!file && !values.demo) throw new UsageError("Missing the JSONL file. Usage: sft-template-lens check <file.jsonl> --demo");

    const failOn = values["fail-on"] ?? "error";
    if (!["error", "warning", "never"].includes(failOn)) throw new UsageError(`--fail-on must be error, warning or never, got "${failOn}".`);
    const maxSeqLen = values["max-seq-len"] === undefined ? DEFAULT_MAX_SEQ_LEN : Number(values["max-seq-len"]);
    if (!Number.isInteger(maxSeqLen) || maxSeqLen < 1) throw new UsageError(`--max-seq-len must be a positive integer, got "${values["max-seq-len"]}".`);

    let text: string;
    if (file) {
      try {
        text = readFileSync(file, "utf8");
      } catch {
        throw new UsageError(`Cannot read "${file}". Check the path.`);
      }
    } else {
      text = DEMO_JSONL;
    }
    const bundle = await loadBundle(values);
    const report = await inspectDataset(text, bundle, { maxSeqLen, date: values.date ?? DEFAULT_DATE });

    if (values["out-clean"]) writeFileSync(values["out-clean"], cleanJsonl(report));
    if (values["out-issues"]) writeFileSync(values["out-issues"], issuesJsonl(report));

    if (values.json) {
      const slim = { summary: report.summary, template: { ...report.template, specialTokenIds: undefined }, options: report.options, findings: allIssues(report) };
      io.out(JSON.stringify(slim, null, 2));
    } else {
      io.out(renderSummary(report, file ?? "(bundled demo)"));
    }
    if (values.show !== undefined) {
      const line = Number(values.show);
      const sample = report.results.find((r) => r.line === line);
      if (!sample) throw new UsageError(`--show ${values.show}: no sample at that line. Lines with data: ${report.results.map((r) => r.line).join(", ")}.`);
      io.out("\n" + renderTokenView(sample, maxSeqLen));
    }

    const hasError = report.summary.errors > 0;
    const hasWarning = report.summary.warnings > 0;
    if (failOn === "error" && hasError) return 1;
    if (failOn === "warning" && (hasError || hasWarning)) return 1;
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.err(`error: ${message}`);
    if (!(error instanceof UsageError) && /fetch failed/i.test(message)) io.err("hint: behind a proxy, run with NODE_USE_ENV_PROXY=1; or use --template-dir with local files.");
    return 2;
  }
}

// Closing the pipe early (for example `| head`) is normal for a CLI: stop quietly instead of printing a stack.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw e;
});

process.exitCode = await run(process.argv.slice(2));
