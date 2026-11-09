import { describe, expect, test } from "vitest";
import { applyTruncation } from "../src/core/inspect";
import { byLine, inspectDemo, rulesOf } from "./helpers";

// AC-5: right truncation removes the answer first; the report says so.
describe("max_seq_length truncation", () => {
  test("256 tokens: long prompt -> E005, long answer -> W101 with the number of lost tokens", async () => {
    const report = await inspectDemo("smollm2", { maxSeqLen: 256 });
    const long = byLine(report, 4);
    expect(rulesOf(long)).toContain("E005");
    expect(long.trainTokensAfterTruncation).toBe(0);
    const partial = byLine(report, 5);
    const w101 = partial.issues.find((i) => i.rule === "W101")!;
    expect(w101.message).toContain(`loses ${partial.trainTokens - partial.trainTokensAfterTruncation} of ${partial.trainTokens}`);
    expect(partial.trainTokensAfterTruncation).toBeGreaterThan(0);
    expect(report.summary.zeroTrainAfterTruncation).toBe(1);
  });

  test("4096 tokens: both disappear, without rendering again", async () => {
    const small = await inspectDemo("smollm2", { maxSeqLen: 256 });
    const big = applyTruncation(small, 4096);
    expect(rulesOf(byLine(big, 4))).not.toContain("E005");
    expect(rulesOf(byLine(big, 5))).not.toContain("W101");
    expect(big.results[3]!.ids).toBe(small.results[3]!.ids); // same arrays: nothing was re-tokenized
    expect(big.summary.zeroTrainAfterTruncation).toBe(0);
  });

  test("a sample with no assistant turn is E004 (loss would be zero) whatever the limit", async () => {
    const { inspectDataset } = await import("../src/core/inspect");
    const { loadBundled } = await import("../src/core/loaders/bundled");
    const report = await inspectDataset('{"messages":[{"role":"user","content":"hi"}]}\n', loadBundled("smollm2"));
    expect(rulesOf(report.results[0]!)).toContain("E004");
  });

  test("invalid limits are rejected with a fix", async () => {
    const small = await inspectDemo("smollm2");
    expect(() => applyTruncation(small, 0)).toThrow(/positive integer/);
  });
});
