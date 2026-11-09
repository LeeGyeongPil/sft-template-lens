import type { Issue, Message, Severity } from "./types";

export interface RuleInfo {
  id: string;
  severity: Severity;
  /** Short English description (CLI, docs). */
  en: string;
  /** Short Korean description (web UI). */
  ko: string;
}

/** Fixed rule ids. Never renumber: CI pipelines may match on them. */
export const RULES: RuleInfo[] = [
  { id: "E001", severity: "error", en: "Line is not valid JSON", ko: "JSON 파싱 실패" },
  { id: "E002", severity: "error", en: "Unknown format or missing keys", ko: "형식 판별 불가 또는 필수 키 없음" },
  { id: "E003", severity: "error", en: "Chat template raised an error", ko: "템플릿 렌더 예외" },
  { id: "E004", severity: "error", en: "No trained tokens (before truncation)", ko: "학습 토큰 0개(잘림 전)" },
  { id: "E005", severity: "error", en: "No trained tokens after truncation", ko: "잘림 후 학습 토큰 0개" },
  { id: "W101", severity: "warning", en: "Truncation removes some trained tokens", ko: "일부 학습 토큰이 잘림" },
  { id: "W102", severity: "warning", en: "Role order problem", ko: "역할 순서 위반" },
  { id: "W103", severity: "warning", en: "Empty assistant message", ko: "빈 어시스턴트 답" },
  { id: "W104", severity: "warning", en: "Duplicate sample", ko: "중복 샘플" },
  { id: "W105", severity: "warning", en: "Double BOS risk", ko: "이중 BOS 위험" },
  { id: "W106", severity: "warning", en: "Template depends on the current date", ko: "날짜 의존 템플릿" },
  { id: "W107", severity: "warning", en: "Approximate mask (no generation markers)", ko: "근사 마스크" },
  { id: "W108", severity: "warning", en: "Syntax that differs between JS and Python Jinja", ko: "JS/Python Jinja 차이 가능 구문" },
  { id: "W109", severity: "warning", en: "System content missing from the rendered text", ko: "system 내용이 렌더 결과에 없음" },
  { id: "W110", severity: "warning", en: "Non-prefix template", ko: "비접두 템플릿" },
  { id: "W111", severity: "warning", en: "Approximate mask failed", ko: "근사 마스크 실패" },
  { id: "W112", severity: "warning", en: "Mixed dataset formats", ko: "여러 데이터 형식이 섞임" },
];

export function ruleInfo(id: string): RuleInfo | undefined {
  return RULES.find((r) => r.id === id);
}

const issue = (rule: string, line: number, message: string): Issue => ({
  rule,
  severity: ruleInfo(rule)?.severity ?? "warning",
  line,
  message: `Line ${line}: ${message}`,
});

/** W102 / W103 on the normalized messages of one sample. */
export function structureIssues(line: number, messages: Message[]): Issue[] {
  const out: Issue[] = [];
  const dialog = messages.filter((m) => m.role !== "system");
  for (let i = 1; i < dialog.length; i++) {
    const a = dialog[i - 1]!.role;
    if (a === dialog[i]!.role && (a === "user" || a === "assistant")) {
      out.push(issue("W102", line, `two consecutive "${a}" messages (turns ${i} and ${i + 1}).`));
      break;
    }
  }
  const last = messages[messages.length - 1];
  if (last && last.role !== "assistant") {
    out.push(issue("W102", line, `the conversation ends with "${last.role}", so the last turn is never trained on.`));
  }
  if (messages.some((m) => m.role === "assistant" && m.content.trim() === "")) {
    out.push(issue("W103", line, "an assistant message is empty."));
  }
  return out;
}

/** W109: a system message whose text is not in the rendered chat (the template silently drops it). */
export function systemDroppedIssue(line: number, messages: Message[], rendered: string): Issue | null {
  for (const m of messages) {
    if (m.role === "system" && m.content.trim() !== "" && !rendered.includes(m.content.trim())) {
      return issue("W109", line, "the system message does not appear in the rendered text; this template drops it.");
    }
  }
  return null;
}

/** Key used for duplicate detection: the normalized conversation. */
export const sampleKey = (messages: Message[]): string => JSON.stringify(messages);

export const duplicateIssue = (line: number, firstLine: number): Issue =>
  issue("W104", line, `identical to line ${firstLine} after normalization.`);

export const renderErrorIssue = (line: number, reason: string): Issue => issue("E003", line, `the chat template raised: ${reason}`);
