import { describe, expect, test } from "vitest";
import { inspectDataset } from "../src/core/inspect";
import { loadBundled } from "../src/core/loaders/bundled";
import { byLine, inspectDemo, readRepo, rulesOf } from "./helpers";

// AC-6: format checks.
describe("sample checks", () => {
  test("a template that rejects system messages fails only those samples (E003) and keeps going", async () => {
    const report = await inspectDemo("system-unsupported");
    for (const line of [1, 8, 12]) {
      const r = byLine(report, line);
      expect(rulesOf(r)).toContain("E003");
      expect(r.issues.find((i) => i.rule === "E003")!.message).toContain("System role not supported");
    }
    for (const line of [2, 3, 4, 5]) expect(rulesOf(byLine(report, line))).not.toContain("E003");
    expect(byLine(report, 2).tokenCount).toBeGreaterThan(0);
  });

  test("W102, W103 and W104 on the demo data", async () => {
    const report = await inspectDemo("smollm2");
    expect(rulesOf(byLine(report, 6))).toContain("W103");
    expect(rulesOf(byLine(report, 7))).toContain("W102"); // two user turns in a row
    expect(rulesOf(byLine(report, 10))).toContain("W102"); // ends with a user turn
    expect(byLine(report, 8).issues.find((i) => i.rule === "W104")!.message).toContain("line 1");
    expect(rulesOf(byLine(report, 1))).toEqual([]);
  });

  test("W109 when the template silently drops the system message", async () => {
    const dropping = {
      ...loadBundled("smollm2"),
      template: "{% for m in messages %}{% if m.role != 'system' %}<|im_start|>{{ m.role }}\n{{ m.content }}<|im_end|>\n{% endif %}{% endfor %}",
    };
    const report = await inspectDataset(readRepo("examples/demo.jsonl"), dropping);
    expect(rulesOf(byLine(report, 1))).toContain("W109");
    expect(rulesOf(byLine(report, 3))).not.toContain("W109");
  });

  test("W105 double BOS when the template writes BOS and the tokenizer adds it again", async () => {
    const base = loadBundled("smollm2");
    const tokenizerJson = {
      ...base.tokenizerJson,
      post_processor: { type: "TemplateProcessing", single: [{ SpecialToken: { id: "<|im_start|>", type_id: 0 } }, { Sequence: { id: "A", type_id: 0 } }] },
    };
    const bundle = { ...base, tokenizerJson, template: "{{ bos_token }}{% for m in messages %}{{ m.content }}{% endfor %}" };
    const report = await inspectDataset('{"messages":[{"role":"user","content":"a"},{"role":"assistant","content":"b"}]}\n', bundle);
    expect(report.template.issues.map((i) => i.rule)).toContain("W105");
  });

  test("W108 flags syntax where the JS Jinja port differs from Python", async () => {
    const risky = { ...loadBundled("smollm2"), template: "{% for m in messages %}{{ m.content.strip('x') }}{% endfor %}" };
    const report = await inspectDataset('{"messages":[{"role":"user","content":"a"},{"role":"assistant","content":"b"}]}\n', risky);
    expect(report.template.issues.map((i) => i.rule)).toContain("W108");
  });

  test("a template that cannot be parsed gives a clear error instead of a crash", async () => {
    const broken = { ...loadBundled("smollm2"), template: "{% for m in messages %}" };
    await expect(inspectDataset("{}\n", broken)).rejects.toThrow(/could not be parsed/);
  });

  test("mixed formats give the dataset-level W112", async () => {
    const text = readRepo("examples/demo-alpaca.jsonl") + readRepo("examples/demo-sharegpt.jsonl");
    const report = await inspectDataset(text, loadBundled("smollm2"));
    expect(report.datasetIssues.map((i) => i.rule)).toEqual(["W112"]);
  });
});
