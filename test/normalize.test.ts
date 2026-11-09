import { describe, expect, test } from "vitest";
import { inspectDataset } from "../src/core/inspect";
import { normalizeRow } from "../src/core/formats";
import { parseJsonl } from "../src/core/jsonl";
import { loadBundled } from "../src/core/loaders/bundled";
import { readRepo } from "./helpers";

// AC-1: three dataset formats normalize to the same role/content conversation; bad lines are reported with line numbers.
// Rows that fail to normalize (the deliberately broken demo lines) are skipped here and tested separately below.
const messagesOf = (path: string) =>
  parseJsonl(readRepo(path)).rows.flatMap((row) => {
    const res = normalizeRow(row.value, row.line);
    return "sample" in res ? [res.sample] : [];
  });

describe("format normalization", () => {
  const openai = messagesOf("examples/demo.jsonl");

  test("ShareGPT demo rows equal the OpenAI rows they were made from", () => {
    const sharegpt = messagesOf("examples/demo-sharegpt.jsonl");
    expect(sharegpt.map((s) => s.format)).toEqual(["sharegpt", "sharegpt", "sharegpt", "sharegpt"]);
    const wanted = [1, 2, 3, 12].map((line) => openai.find((s) => s.line === line)!.messages);
    expect(sharegpt.map((s) => s.messages)).toEqual(wanted);
  });

  test("Alpaca rows become one user and one assistant message (input appended to the instruction)", () => {
    const alpaca = messagesOf("examples/demo-alpaca.jsonl");
    expect(alpaca[0]!.messages).toEqual(openai.find((s) => s.line === 3)!.messages);
    expect(alpaca[1]!.messages).toEqual([
      { role: "user", content: "Translate to Korean.\n\nGood morning" },
      { role: "assistant", content: "좋은 아침입니다." },
    ]);
  });

  test("unknown shapes are E002 and broken JSON is E001, with line numbers, and processing continues", async () => {
    const report = await inspectDataset(readRepo("examples/demo.jsonl"), loadBundled("smollm2"));
    const e001 = report.results.find((r) => r.line === 9)!;
    const e002 = report.results.find((r) => r.line === 11)!;
    expect(e001.issues[0]).toMatchObject({ rule: "E001", line: 9 });
    expect(e002.issues[0]).toMatchObject({ rule: "E002", line: 11 });
    expect(report.results.filter((r) => r.text !== null).length).toBe(10);
  });

  test("helpful errors for missing keys, unknown ShareGPT roles and list content", () => {
    expect(normalizeRow({ messages: [{ content: "x" }] }, 3)).toMatchObject({ issue: { rule: "E002", line: 3 } });
    expect(normalizeRow({ conversations: [{ from: "alien", value: "x" }] }, 4)).toMatchObject({ issue: { rule: "E002" } });
    const res = normalizeRow({ messages: [{ role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }] }, 5);
    expect("sample" in res && res.sample.messages[0]!.content).toBe("ab");
  });

  test("blank lines and a BOM are tolerated, CRLF too", () => {
    const { rows, issues } = parseJsonl('﻿{"a":1}\r\n\r\n{"a":2}\r\n');
    expect(rows.map((r) => r.line)).toEqual([1, 3]);
    expect(issues).toEqual([]);
  });
});
