import { expect, test } from "vitest";
import { inspectDataset } from "../src/core/inspect";
import { loadBundled } from "../src/core/loaders/bundled";
import { demoText, readRepo } from "./helpers";

// AC-7: run as `LANG=ko_KR.UTF-8 LC_ALL=ko_KR.UTF-8 TZ=Asia/Seoul npx vitest run test/date-locale.test.ts`
test("fixed date: strftime_now is replaced, W106 is reported, and the result does not depend on locale or timezone", async () => {
  const golden = JSON.parse(readRepo("test/golden/parity.json")) as { templates: { smollm3: Record<string, { text: string; input_ids: number[] }> } };
  const report = await inspectDataset(demoText(), loadBundled("smollm3"), { maxSeqLen: 8192 });
  const first = report.results[0]!;
  expect(report.template.issues.map((i) => i.rule)).toContain("W106");
  expect(first.text).toContain("Today Date: 01 January 2026");
  expect(first.text).not.toMatch(/월/); // no Korean month name from the machine locale
  expect(first.ids).toEqual(golden.templates.smollm3["1"]!.input_ids);
  expect(first.tokenCount).toBe(golden.templates.smollm3["1"]!.input_ids.length);

  const other = await inspectDataset(demoText(), loadBundled("smollm3"), { date: "2026-03-05" });
  expect(other.results[0]!.text).toContain("Today Date: 05 March 2026");
  await expect(inspectDataset("{}\n", loadBundled("smollm3"), { date: "05/03/2026" })).rejects.toThrow(/YYYY-MM-DD/);
});
