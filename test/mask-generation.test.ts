import { describe, expect, test } from "vitest";
import { splitSentinels, TemplateEngine } from "../src/core/template";
import { loadBundled } from "../src/core/loaders/bundled";
import { byLine, inspectDemo, rulesOf, trainedText } from "./helpers";

// AC-3: {% generation %} tags are recovered with sentinels and give the exact TRL assistant_only_loss mask.
describe("generation markers (SmolLM3)", () => {
  test("strategy is exact-generation and only assistant turns are trained", async () => {
    const report = await inspectDemo("smollm3", { maxSeqLen: 8192 });
    expect(report.template.maskStrategy).toBe("exact-generation");
    for (const line of [1, 2, 3, 12]) {
      const r = byLine(report, line);
      const expected = r.messages
        .filter((m) => m.role === "assistant")
        .map((m) => `<|im_start|>assistant\n${m.content}<|im_end|>\n`)
        .join("");
      expect(trainedText(r), `line ${line}`).toBe(expected);
      expect(r.maskValid).toBe(true);
      expect(rulesOf(r)).not.toContain("W111");
    }
  });

  test("the sentinel render equals the plain render once the sentinels are removed", () => {
    const engine = new TemplateEngine(loadBundled("smollm3"), "2026-01-01");
    const messages = [
      { role: "system", content: "Be brief." },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const { clean, spans, balanced } = splitSentinels(engine.renderWithGenerationSentinels(messages));
    expect(clean).toBe(engine.render(messages));
    expect(balanced).toBe(true);
    expect(spans).toHaveLength(1);
    expect(clean.slice(spans[0]![0], spans[0]![1])).toBe("<|im_start|>assistant\nhello<|im_end|>\n");
  });

  test("whitespace control around generation tags is preserved", () => {
    const bundle = { ...loadBundled("smollm2"), template: "{%- for m in messages -%}\n{%- if m.role == 'assistant' -%}{%- generation -%} A:{{ m.content }} {%- endgeneration -%}{%- else -%}U:{{ m.content }}{%- endif -%}\n{%- endfor -%}" };
    const engine = new TemplateEngine(bundle, "2026-01-01");
    const msgs = [{ role: "user", content: "q" }, { role: "assistant", content: "a" }];
    const { clean, spans } = splitSentinels(engine.renderWithGenerationSentinels(msgs));
    expect(clean).toBe(engine.render(msgs));
    expect(clean.slice(spans[0]![0], spans[0]![1])).toBe("A:a");
  });
});
