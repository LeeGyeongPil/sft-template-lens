import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { root } from "./helpers";

// AC-9: the built CLI is run as a child process (pretest builds dist-cli/cli.mjs).
const cli = join(root, "dist-cli", "cli.mjs");
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
const scratch = mkdtempSync(join(tmpdir(), "stl-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("CLI", () => {
  test("summary lists rule counts and exits 1 when there are errors", () => {
    const r = run(["check", "examples/demo.jsonl", "--demo", "--max-seq-len", "256"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/E005 +error +1/);
    expect(r.stdout).toContain("practice (mock)");
  });

  test("--fail-on never exits 0 and --fail-on warning is stricter", () => {
    expect(run(["check", "examples/demo.jsonl", "--demo", "--fail-on", "never"]).status).toBe(0);
    const clean = join(scratch, "clean.jsonl");
    execFileSync(process.execPath, [cli, "check", "examples/demo.jsonl", "--demo", "--fail-on", "never", "--out-clean", clean], { cwd: root });
    expect(run(["check", clean, "--demo"]).status).toBe(0); // no errors left in the cleaned file (W107 is a warning)
    expect(run(["check", clean, "--demo", "--fail-on", "warning"]).status).toBe(1);
  });

  test("--json prints valid JSON with summary.errors", () => {
    const r = run(["check", "examples/demo.jsonl", "--demo", "--json", "--fail-on", "never"]);
    const parsed = JSON.parse(r.stdout) as { summary: { errors: number }; findings: unknown[] };
    expect(typeof parsed.summary.errors).toBe("number");
    expect(parsed.summary.errors).toBeGreaterThan(0);
    expect(parsed.findings.length).toBeGreaterThan(0);
  });

  test("--show prints an ANSI colored token view", () => {
    const r = run(["check", "examples/demo.jsonl", "--demo", "--show", "1", "--fail-on", "never"]);
    expect(r.stdout).toContain("\x1b[42;30m"); // trained tokens
    expect(r.stdout).toContain("\x1b[90m"); // masked tokens
    expect(r.stdout).toContain("Line 1:");
  });

  test("--out-issues writes JSONL findings", () => {
    const out = join(scratch, "issues.jsonl");
    run(["check", "examples/demo.jsonl", "--demo", "--out-issues", out]);
    const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { rule: string });
    expect(lines.map((l) => l.rule)).toContain("E001");
  });

  test("empty or blank-only files exit 2 with a fix; JSON arrays get a JSONL hint (Q-2)", () => {
    const empty = join(scratch, "empty.jsonl");
    writeFileSync(empty, "");
    const r = run(["check", empty, "--demo"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("The file has no JSONL rows");
    const blank = join(scratch, "blank.jsonl");
    writeFileSync(blank, "\n  \n\n");
    expect(run(["check", blank, "--demo"]).status).toBe(2);
    const arr = join(scratch, "array.json");
    writeFileSync(arr, '[{"messages":[]}]');
    expect(run(["check", arr, "--demo", "--json"]).stdout).toContain("convert it to JSONL");
    const multi = join(scratch, "multi.json");
    writeFileSync(multi, '[\n{"messages":[]}\n]');
    expect(run(["check", multi, "--demo", "--json", "--fail-on", "never"]).stdout).toContain("jq -c");
  });

  test("closing the pipe early does not print an EPIPE stack (Q-3)", () => {
    const cmd = `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)} check examples/demo.jsonl --demo --show 4 --max-seq-len 256 | head -1`;
    const r = spawnSync("sh", ["-c", cmd], { cwd: root, encoding: "utf8" });
    expect(r.stderr).not.toContain("EPIPE");
  });

  test("usage errors exit 2 and say how to fix them", () => {
    const noSource = run(["check", "examples/demo.jsonl"]);
    expect(noSource.status).toBe(2);
    expect(noSource.stderr).toMatch(/--demo.*--template-dir.*--model/);
    expect(run(["check", "nope.jsonl", "--demo"]).stderr).toContain("Cannot read");
    expect(run(["check", "examples/demo.jsonl", "--demo", "--max-seq-len", "abc"]).status).toBe(2);
    expect(run(["check", "examples/demo.jsonl", "--demo", "--template-dir", "x"]).stderr).toContain("only one template source");
  });

  test("--template-dir reads local tokenizer files", () => {
    const r = run(["check", "examples/demo.jsonl", "--template-dir", "fixtures/smollm2-135m", "--fail-on", "never", "--json"]);
    expect(r.status).toBe(0);
    expect((JSON.parse(r.stdout) as { template: { source: string } }).template.source).toBe("local");
  });

  test("--help and --rules work without a file", () => {
    expect(run(["--help"]).stdout).toContain("Usage");
    expect(run(["--rules"]).stdout).toContain("W111");
  });
});

// Language of the tool's own messages: --lang > SFT_TEMPLATE_LENS_LANG > LC_ALL > LC_MESSAGES > LANG. Machine output never changes.
describe("CLI language", () => {
  const blank = { SFT_TEMPLATE_LENS_LANG: "", LC_ALL: "", LC_MESSAGES: "", LANG: "" };
  const demo = ["check", "examples/demo.jsonl", "--demo", "--fail-on", "never"];

  test("--lang beats every environment variable", () => {
    const r = run([...demo, "--lang", "ko"], { ...blank, SFT_TEMPLATE_LENS_LANG: "en", LC_ALL: "en_US.UTF-8" });
    expect(r.stdout).toContain("샘플:");
    expect(r.stdout).not.toContain("samples:");
    expect(run([...demo, "--lang", "en"], { ...blank, LANG: "ko_KR.UTF-8" }).stdout).toContain("samples:");
  });

  test("environment priority and the English fallback", () => {
    const ko = "샘플:";
    expect(run(demo, { ...blank, SFT_TEMPLATE_LENS_LANG: "ko", LC_ALL: "en_US" }).stdout).toContain(ko);
    expect(run(demo, { ...blank, LC_ALL: "ko_KR.UTF-8", LC_MESSAGES: "en_US", LANG: "en_US" }).stdout).toContain(ko);
    expect(run(demo, { ...blank, LC_MESSAGES: "ko_KR.UTF-8", LANG: "en_US" }).stdout).toContain(ko);
    expect(run(demo, { ...blank, LANG: "ko_KR.UTF-8" }).stdout).toContain(ko);
    expect(run(demo, { ...blank, LANG: "fr_FR.UTF-8" }).stdout).toContain("samples:");
    expect(run(demo, blank).stdout).toContain("samples:");
  });

  test("help, rules, token view and errors follow the language", () => {
    const koHelp = run(["--help", "--lang", "ko"], blank).stdout;
    expect(koHelp).toContain("사용법");
    expect(koHelp).toContain("--lang <en|ko>");
    expect(run(["--help"], blank).stdout).toContain("--lang <en|ko>");
    expect(run(["--rules", "--lang", "ko"], blank).stdout).toContain("JSON 파싱 실패");
    expect(run([...demo, "--show", "1", "--lang", "ko"], blank).stdout).toContain("1줄:");
    const err = run(["check", "examples/demo.jsonl"], { ...blank, LANG: "ko_KR.UTF-8" });
    expect(err.status).toBe(2);
    expect(err.stderr).toContain("오류:");
    expect(err.stderr).toContain("--demo");
  });

  test("an invalid --lang value is a usage error (exit 2) that names the choices", () => {
    const r = run([...demo, "--lang", "fr"], blank);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--lang must be en or ko");
    expect(run([...demo, "--lang", "fr"], { ...blank, LANG: "ko_KR" }).stderr).toContain("en 또는 ko");
  });

  test("--json and --out-* are byte-identical in every language", () => {
    const out = (lang: string) => {
      const clean = join(scratch, "lang-" + lang + "-clean.jsonl");
      const issues = join(scratch, "lang-" + lang + "-issues.jsonl");
      const json = run([...demo, "--json", "--lang", lang, "--out-clean", clean, "--out-issues", issues], blank).stdout;
      return { json, clean: readFileSync(clean, "utf8"), issues: readFileSync(issues, "utf8") };
    };
    const en = out("en");
    const ko = out("ko");
    expect(en.json.length).toBeGreaterThan(100);
    expect(ko.json).toBe(en.json);
    expect(ko.clean).toBe(en.clean);
    expect(ko.issues).toBe(en.issues);
  });
});

// Errors that come from the core, the loaders and the option parser follow the chosen language too (exit code 2).
describe("CLI error language", () => {
  const blank = { SFT_TEMPLATE_LENS_LANG: "", LC_ALL: "", LC_MESSAGES: "", LANG: "" };
  const hangul = /[가-힣]/;
  const empty = join(scratch, "empty.jsonl");
  writeFileSync(empty, "");

  const cases: Array<[string, string[], RegExp, RegExp]> = [
    ["empty file", ["check", empty, "--demo"], /The file has no JSONL rows/, /JSONL 행이 없습니다/],
    ["bad --date", ["check", "examples/demo.jsonl", "--demo", "--date", "2026-13-40"], /Invalid date "2026-13-40"/, /달력에 없는 날/],
    ["bad --date format", ["check", "examples/demo.jsonl", "--demo", "--date", "tomorrow"], /Use YYYY-MM-DD/, /YYYY-MM-DD 형식/],
    ["unknown option", ["check", "examples/demo.jsonl", "--demo", "--bogus"], /Unknown option '--bogus'\. Try --help\./, /알 수 없는 옵션 '--bogus'/],
    ["--lang without a value", ["check", "examples/demo.jsonl", "--demo", "--lang"], /Option '--lang' needs a value/, /'--lang' 에 값이 필요합니다/],
    ["missing --template-dir", ["check", "examples/demo.jsonl", "--template-dir", "/nonexistent-dir"], /\/nonexistent-dir\/tokenizer\.json not found/, /\/nonexistent-dir\/tokenizer\.json 를 찾을 수 없습니다/],
    ["bad --model id", ["check", "examples/demo.jsonl", "--model", "nope"], /is not a Hub model id/, /허브 모델 ID 가 아닙니다/],
  ];

  test.each(cases)("%s: exit 2, English by default and Korean with --lang ko or LANG=ko", (_name, args, en, ko) => {
    const e = run(args, blank);
    expect(e.status).toBe(2);
    expect(e.stderr).toMatch(en);
    expect(e.stderr).not.toMatch(hangul);
    const viaFlag = run(["--lang", "ko", ...args.filter((a) => a !== "--lang")], blank);
    // "--lang without a value" has to stay last, so it is checked through the environment below.
    if (args[args.length - 1] !== "--lang") {
      expect(viaFlag.status).toBe(2);
      expect(viaFlag.stderr).toMatch(ko);
      expect(viaFlag.stderr).toContain("오류:");
    }
    const viaEnv = run(args, { ...blank, LANG: "ko_KR.UTF-8" });
    expect(viaEnv.status).toBe(2);
    expect(viaEnv.stderr).toMatch(ko);
  });
});
