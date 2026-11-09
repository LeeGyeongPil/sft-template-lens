import { splitSentinels, SPAN_END, SPAN_START, type TemplateEngine } from "./template";
import { isContinuation, tokenStarts } from "./tokenize";
import type { Issue, MaskStrategy, Message } from "./types";

export interface SpanResult {
  strategy: MaskStrategy;
  /** Rendered text without sentinels (equal to the plain render when `valid`). */
  text: string;
  /** Character spans `[start, end)` that are trained on. */
  spans: Array<[number, number]>;
  valid: boolean;
  issue?: Issue;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const w111 = (reason: string): Issue => ({
  rule: "W111",
  severity: "warning",
  line: null,
  message: `Approximate mask failed: ${reason}. The mask is hidden for this sample.`,
});

/**
 * Find the trained character spans of one conversation.
 * - `exact-generation`: the template has {% generation %} tags; their output is the trained text (same as TRL assistant_only_loss).
 * - `approx-content`: wrap each assistant content in sentinels and render the whole conversation once, then extend
 *   each span over the end-of-turn special token. No incremental renders are differenced (see W110).
 */
export function findSpans(
  engine: TemplateEngine,
  messages: Message[],
  plain: string,
  specialStrings: string[],
): SpanResult {
  if (engine.hasGeneration) {
    try {
      const { clean, spans, balanced } = splitSentinels(engine.renderWithGenerationSentinels(messages));
      if (clean !== plain || !balanced) {
        return { strategy: "exact-generation", text: plain, spans: [], valid: false, issue: w111("generation markers changed the rendered text") };
      }
      return { strategy: "exact-generation", text: plain, spans, valid: true };
    } catch (error) {
      return { strategy: "exact-generation", text: plain, spans: [], valid: false, issue: w111(errorText(error)) };
    }
  }

  const assistants = messages.filter((m) => m.role === "assistant").length;
  const wrapped = messages.map((m) => (m.role === "assistant" ? { ...m, content: wrapContent(m.content) } : m));
  let rendered: string;
  try {
    rendered = engine.render(wrapped);
  } catch (error) {
    return { strategy: "approx-content", text: plain, spans: [], valid: false, issue: w111(errorText(error)) };
  }
  const { clean, spans, balanced } = splitSentinels(rendered);
  if (clean !== plain) {
    return { strategy: "approx-content", text: plain, spans: [], valid: false, issue: w111("the template changes assistant content, so it cannot be located in the rendered text") };
  }
  if (!balanced || spans.length !== assistants) {
    return { strategy: "approx-content", text: plain, spans: [], valid: false, issue: w111(`found ${spans.length} of ${assistants} assistant spans`) };
  }
  // Longest special token first so a longer marker wins over a shorter prefix of it.
  const specials = [...specialStrings].sort((a, b) => b.length - a.length);
  const extended = spans.map(([a, b]): [number, number] => {
    const hit = specials.find((s) => s.length > 0 && plain.startsWith(s, b));
    return [a, hit ? b + hit.length : b];
  });
  return { strategy: "approx-content", text: plain, spans: extended, valid: true };
}

/** Convert character spans into a 0/1 token mask: a token is trained when its characters overlap a span. */
export function spansToTokenMask(ends: number[], spans: Array<[number, number]>): number[] {
  const starts = tokenStarts(ends);
  const mask = new Array<number>(ends.length).fill(0);
  for (let k = 0; k < ends.length; k++) {
    // Empty pieces (continuation bytes of one character) follow the token that owns the character.
    if (isContinuation(ends, k)) {
      mask[k] = mask[k - 1]!;
      continue;
    }
    const s = starts[k]!;
    const e = ends[k]!;
    for (const [a, b] of spans) {
      if (s < b && e > a) {
        mask[k] = 1;
        break;
      }
    }
  }
  return mask;
}

/** Put the sentinels inside the surrounding whitespace so templates that trim content still render the same text. */
function wrapContent(content: string): string {
  const lead = /^\s*/.exec(content)![0];
  const rest = content.slice(lead.length);
  const trail = /\s*$/.exec(rest)![0];
  const core = rest.slice(0, rest.length - trail.length);
  return lead + SPAN_START + core + SPAN_END + trail;
}
