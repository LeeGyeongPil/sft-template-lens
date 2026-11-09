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
