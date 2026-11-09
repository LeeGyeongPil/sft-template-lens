import { describe, expect, test } from "vitest";
import { byLine, inspectDemo, readRepo } from "./helpers";

// AC-2: the TypeScript engine must match transformers 5.22.2 (Python Jinja) on rendered text, input_ids and assistant masks.
const golden = JSON.parse(readRepo("test/golden/parity.json")) as {
  generator: { transformers: string };
  templates: Record<string, Record<string, { text: string; input_ids: number[]; assistant_mask?: number[] }>>;
};

describe("Python parity", () => {
  test("golden file was made with the pinned reference versions", () => {
    expect(golden.generator.transformers).toBe("5.22.2");
  });

  for (const [name, lines] of Object.entries(golden.templates)) {
    test(`${name}: text and input_ids equal Python for every demo conversation`, async () => {
      const report = await inspectDemo(name, { maxSeqLen: 8192 });
      expect(Object.keys(lines).length).toBeGreaterThanOrEqual(6);
      for (const [line, expected] of Object.entries(lines)) {
        const got = byLine(report, Number(line));
        expect(got.text, `${name} line ${line} text`).toBe(expected.text);
        expect(got.ids, `${name} line ${line} ids`).toEqual(expected.input_ids);
        if (expected.assistant_mask) expect(got.mask, `${name} line ${line} mask`).toEqual(expected.assistant_mask);
      }
    });
  }

  test("SmolLM3 has Python assistant masks to compare against", () => {
    const first = Object.values(golden.templates.smollm3!)[0]!;
    expect(first.assistant_mask?.some((v) => v === 1)).toBe(true);
  });
});
