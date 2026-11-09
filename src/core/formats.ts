import { ARRAY_HINT } from "./jsonl";
import type { DataFormat, Issue, Message, Sample } from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const SHAREGPT_ROLES: Record<string, string> = {
  system: "system",
  human: "user",
  user: "user",
  gpt: "assistant",
  assistant: "assistant",
  chatgpt: "assistant",
  bing: "assistant",
  bard: "assistant",
  model: "assistant",
  tool: "tool",
  function: "tool",
  observation: "tool",
};

export type NormalizeResult = { sample: Sample } | { issue: Issue };

const fail = (line: number, message: string): NormalizeResult => ({
  issue: { rule: "E002", severity: "error", line, message: `Line ${line}: ${message}` },
});

/** OpenAI content may be a string or a list of `{type:"text", text}` parts. */
function contentToString(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (content === null || content === undefined) return "";
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (isObj(part) && typeof part.text === "string") parts.push(part.text);
      else return null;
    }
    return parts.join("");
  }
  return null;
}

/** Detect the dataset format of one parsed JSON value and convert it to role/content messages. */
export function normalizeRow(value: unknown, line: number): NormalizeResult {
  if (!isObj(value)) return fail(line, Array.isArray(value) ? `expected a JSON object per line. ${ARRAY_HINT}` : "expected a JSON object per line.");

  if (Array.isArray(value.messages)) return fromOpenAI(value.messages, line);

  const convo = value.conversations ?? value.conversation;
  if (Array.isArray(convo)) return fromShareGPT(convo, line);

  if (typeof value.instruction === "string") return fromAlpaca(value, line);

  const keys = Object.keys(value).slice(0, 6).join(", ");
  return fail(
    line,
    `could not detect a chat format (keys: ${keys || "none"}). Expected "messages" (OpenAI), "conversations" (ShareGPT) or "instruction"/"output" (Alpaca).`,
  );
}

function fromOpenAI(raw: unknown[], line: number): NormalizeResult {
  const messages: Message[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i];
    if (!isObj(m) || typeof m.role !== "string") return fail(line, `messages[${i}] needs a string "role".`);
    const content = contentToString(m.content);
    if (content === null) return fail(line, `messages[${i}].content must be a string or a list of text parts.`);
    messages.push({ role: m.role, content });
  }
  if (messages.length === 0) return fail(line, `"messages" is empty.`);
  return { sample: { line, format: "openai", messages } };
}

function fromShareGPT(raw: unknown[], line: number): NormalizeResult {
  const messages: Message[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i];
    if (!isObj(m) || typeof m.from !== "string" || typeof m.value !== "string") {
      return fail(line, `conversations[${i}] needs string "from" and "value".`);
    }
    const role = SHAREGPT_ROLES[m.from.toLowerCase()];
    if (!role) return fail(line, `conversations[${i}].from "${m.from}" is not a known ShareGPT role (human, gpt, system, tool).`);
    messages.push({ role, content: m.value });
  }
  if (messages.length === 0) return fail(line, `"conversations" is empty.`);
  return { sample: { line, format: "sharegpt", messages } };
}

function fromAlpaca(row: Obj, line: number): NormalizeResult {
  if (typeof row.output !== "string") return fail(line, `Alpaca rows need a string "output".`);
  const input = typeof row.input === "string" ? row.input.trim() : "";
  const user = input ? `${row.instruction}\n\n${input}` : (row.instruction as string);
  return {
    sample: {
      line,
      format: "alpaca",
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: row.output },
      ],
    },
  };
}

/** Dataset-level hint when several formats are mixed in one file (W112). */
export function mixedFormatIssue(formats: DataFormat[]): Issue | null {
  const kinds = [...new Set(formats)];
  if (kinds.length < 2) return null;
  return {
    rule: "W112",
    severity: "warning",
    line: null,
    message: `The file mixes ${kinds.join(", ")} rows. They were all normalized to role/content, but check that this is intended.`,
  };
}
