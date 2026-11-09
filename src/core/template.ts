import { Template } from "@huggingface/jinja";
import { parseFixedDate, strftime, type FixedDate } from "./dates";
import type { Issue, Message, TemplateBundle } from "./types";

/** Private-use characters that mark the start/end of a span inside rendered text. */
export const SPAN_START = "";
export const SPAN_END = "";

const GENERATION_TAG = /{%(-?)\s*generation\s*(-?)%}/g;
const END_GENERATION_TAG = /{%(-?)\s*endgeneration\s*(-?)%}/g;

export function hasGenerationTags(source: string): boolean {
  return /{%-?\s*generation\s*-?%}/.test(source);
}

/**
 * `@huggingface/jinja` deletes `{% generation %}` tags in its lexer, so the span information is lost.
 * Replacing the tags by output expressions that print sentinels keeps it (whitespace control is preserved).
 */
export function withGenerationSentinels(source: string): string {
  return source
    .replace(GENERATION_TAG, (_m, a: string, b: string) => `{{${a} "${SPAN_START}" ${b}}}`)
    .replace(END_GENERATION_TAG, (_m, a: string, b: string) => `{{${a} "${SPAN_END}" ${b}}}`);
}

/** `strftime_now` is a built-in global that cannot be overridden, so calls are renamed to our fixed-date function. */
export function replaceStrftime(source: string): string {
  return source.replace(/\bstrftime_now\s*\(/g, "__lens_strftime(");
}

export function usesDate(source: string): boolean {
  return /\bstrftime_now\s*\(|\bdate_string\b/.test(source);
}

/** Remove sentinels from rendered text and return the character spans that were between them. */
export function splitSentinels(rendered: string): { clean: string; spans: Array<[number, number]>; balanced: boolean } {
  const spans: Array<[number, number]> = [];
  let clean = "";
  let open = -1;
  let balanced = true;
  for (const ch of rendered) {
    if (ch === SPAN_START) {
      if (open !== -1) balanced = false;
      open = clean.length;
    } else if (ch === SPAN_END) {
      if (open === -1) balanced = false;
      else spans.push([open, clean.length]);
      open = -1;
    } else {
      clean += ch;
    }
  }
  if (open !== -1) balanced = false;
  return { clean, spans, balanced };
}

function specialString(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { content?: unknown }).content === "string") {
    return (v as { content: string }).content;
  }
  return "";
}

/** Compiles the bundle's template once and renders conversations with fixed, locale-free globals. */
export class TemplateEngine {
  readonly hasGeneration: boolean;
  private readonly plain: Template;
  private readonly sentinel: Template | null;
  private readonly date: FixedDate;
  readonly bosToken: string;
  readonly eosToken: string;

  constructor(bundle: TemplateBundle, date: string) {
    this.date = parseFixedDate(date);
    const base = replaceStrftime(bundle.template);
    this.hasGeneration = hasGenerationTags(base);
    try {
      this.plain = new Template(base);
      this.sentinel = this.hasGeneration ? new Template(withGenerationSentinels(base)) : null;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`The chat template could not be parsed: ${reason}`);
    }
    this.bosToken = specialString(bundle.tokenizerConfig, "bos_token");
    this.eosToken = specialString(bundle.tokenizerConfig, "eos_token");
  }

  private context(messages: Message[]): Record<string, unknown> {
    return {
      messages,
      add_generation_prompt: false,
      bos_token: this.bosToken,
      eos_token: this.eosToken,
      date_string: strftime("%d %b %Y", this.date),
      __lens_strftime: (fmt: string) => strftime(fmt, this.date),
    };
  }

  /** Render exactly like `apply_chat_template(messages, tokenize=False)`. Throws on `raise_exception`. */
  render(messages: Message[]): string {
    return this.plain.render(this.context(messages));
  }

  /** Render with `{% generation %}` spans marked by sentinels. Only valid when `hasGeneration`. */
  renderWithGenerationSentinels(messages: Message[]): string {
    if (!this.sentinel) throw new Error("This template has no {% generation %} tags.");
    return this.sentinel.render(this.context(messages));
  }
}

/** Static scan for syntax where `@huggingface/jinja` is known to differ from Python Jinja (W108). */
export function scanCompatibility(source: string): Issue[] {
  const found: string[] = [];
  if (/\.(?:strip|lstrip|rstrip)\(\s*[^\s)]/.test(source)) found.push("strip(chars) with an argument");
  if (/\.(?:startswith|endswith)\([^()]*,[^()]*\)/.test(source)) found.push("startswith/endswith with a range argument");
  if (/{%-?\s*(?:break|continue)\b/.test(source)) found.push("{% break %} / {% continue %}");
  if (/[^~]~[^~=]/.test(source.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""'))) found.push("the ~ concatenation operator");
  if (found.length === 0) return [];
  return [
    {
      rule: "W108",
      severity: "warning",
      line: null,
      message: `The template uses ${found.join(", ")}; @huggingface/jinja may render it differently from Python Jinja. Compare one sample with transformers before trusting the result.`,
    },
  ];
}

const PROBE_CONVERSATION: Message[] = [
  { role: "system", content: "You are helpful." },
  { role: "user", content: "2+2?" },
  { role: "assistant", content: "4." },
  { role: "user", content: "3+3?" },
  { role: "assistant", content: "6." },
];

/** The fixed conversation used for template-level diagnostics; falls back to no system message if rejected. */
export function probeRender(engine: TemplateEngine): { messages: Message[]; text: string } | null {
  for (const messages of [PROBE_CONVERSATION, PROBE_CONVERSATION.slice(1)]) {
    try {
      return { messages, text: engine.render(messages) };
    } catch {
      /* try the next probe */
    }
  }
  return null;
}

/**
 * W110: a template is prefix-preserving when rendering the first i messages gives a prefix of the full render.
 * Tools that compute masks by differencing incremental renders are wrong on templates that fail this.
 */
export function checkPrefixPreserving(engine: TemplateEngine): Issue[] {
  const probe = probeRender(engine);
  if (!probe) return [];
  for (let i = 1; i < probe.messages.length; i++) {
    let part: string;
    try {
      part = engine.render(probe.messages.slice(0, i));
    } catch {
      continue;
    }
    if (!probe.text.startsWith(part)) {
      return [
        {
          rule: "W110",
          severity: "warning",
          line: null,
          message:
            "Non-prefix template: rendering the first messages is not a prefix of the full render (for example a <think> block added only to the last turn). Masks computed by differencing incremental renders would be wrong; this tool does not use that method.",
        },
      ];
    }
  }
  return [];
}
