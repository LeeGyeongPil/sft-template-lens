import type { Issue } from "./types";

export const ARRAY_HINT = 'This looks like a JSON array; convert it to JSONL (one object per line), e.g. jq -c ".[]" in.json > out.jsonl';
export const EMPTY_INPUT_MESSAGE = "The file has no JSONL rows. Check the path, or write one JSON object per line.";

export interface JsonlRow {
  /** 1-based line number in the source text. */
  line: number;
  value: unknown;
}

/** Split JSONL text into rows. Blank lines are skipped; broken lines become E001 and do not stop parsing. */
export function parseJsonl(text: string): { rows: JsonlRow[]; issues: Issue[] } {
  const rows: JsonlRow[] = [];
  const issues: Issue[] = [];
  const body = text.replace(/^﻿/, "");
  const lines = body.split(/\r?\n/);
  const arrayHint = body.trimStart().startsWith("[") ? ` ${ARRAY_HINT}` : "";
  lines.forEach((raw, index) => {
    if (raw.trim() === "") return;
    const line = index + 1;
    try {
      rows.push({ line, value: JSON.parse(raw) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      issues.push({ rule: "E001", severity: "error", line, message: `Line ${line} is not valid JSON: ${reason}.${arrayHint}` });
    }
  });
  return { rows, issues };
}
