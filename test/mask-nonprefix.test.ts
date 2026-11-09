import { describe, expect, test } from "vitest";
import { loadBundled } from "../src/core/loaders/bundled";
import { TemplateEngine } from "../src/core/template";
import { byLine, inspectDemo, rulesOf, trainedText } from "./helpers";

// AC-4: Qwen3 adds a <think> block only to the last turn, so incremental-render differencing is wrong; this tool avoids it.
describe("non-prefix template (Qwen3)", () => {
  test("W110 and W107 are reported at template level", async () => {
    const report = await inspectDemo("qwen3");
    const rules = report.template.issues.map((i) => i.rule);
    expect(rules).toContain("W110");
    expect(rules).toContain("W107");
    expect(report.template.maskStrategy).toBe("approx-content");
  });

  test("approximate mask trains only assistant content (plus end token) and never user or system text", async () => {
    const report = await inspectDemo("qwen3", { maxSeqLen: 8192 });
    for (const line of [1, 2, 3, 12]) {
      const r = byLine(report, line);
      expect(r.maskValid, `line ${line}`).toBe(true);
      // Exactly each assistant content plus its end token: no user or system text, no role header, no template-added <think>.
      const expected = r.messages.filter((m) => m.role === "assistant").map((m) => m.content + "<|im_end|>").join("");
      expect(trainedText(r), `line ${line}`).toBe(expected);
    }
  });

  test("the failure this avoids is real: a prefix render is not a prefix of the full render", () => {
    const engine = new TemplateEngine(loadBundled("qwen3"), "2026-01-01");
    const msgs = [
      { role: "user", content: "2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "3+3?" },
      { role: "assistant", content: "6" },
    ];
    const full = engine.render(msgs);
    const notPrefix = [1, 2, 3, 4].filter((n) => !full.startsWith(engine.render(msgs.slice(0, n))));
    expect(notPrefix.length).toBeGreaterThan(0);
  });

  test("a template that rewrites assistant content gets W111 and no mask instead of a wrong one", async () => {
    const bundle = { ...loadBundled("smollm2"), template: "{% for m in messages %}<|im_start|>{{ m.role }}\n{{ m.content[1:] }}<|im_end|>\n{% endfor %}" };
    const { inspectDataset } = await import("../src/core/inspect");
    const report = await inspectDataset('{"messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"yes"}]}\n', bundle);
    const r = report.results[0]!;
    expect(rulesOf(r)).toContain("W111");
    expect(r.maskValid).toBe(false);
  });
});
