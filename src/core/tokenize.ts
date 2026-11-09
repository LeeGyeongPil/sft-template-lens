import { Tokenizer } from "@huggingface/tokenizers";
import type { TemplateBundle } from "./types";

export interface Encoded {
  ids: number[];
  /**
   * Exclusive end character index of every token in the text.
   * Tokens that only hold part of a multi-byte character share the end of the whole character,
   * so the first of them owns the character and the rest are empty pieces.
   */
  ends: number[];
}

/** True when token k is a continuation of the multi-byte character started by an earlier token. */
export function isContinuation(ends: number[], k: number): boolean {
  return k > 0 && ends[k] === ends[k - 1];
}

/** Start index of every token derived from `ends`; continuation tokens share the start of their character. */
export function tokenStarts(ends: number[]): number[] {
  const starts: number[] = [];
  for (let k = 0; k < ends.length; k++) {
    if (k === 0) starts.push(0);
    else starts.push(isContinuation(ends, k) ? starts[k - 1]! : ends[k - 1]!);
  }
  return starts;
}

const REPLACEMENT = "�";
const MAX_GROUP = 8;

function bundleSpecialTokens(bundle: TemplateBundle): Array<{ id: number; content: string }> {
  const added = bundle.tokenizerJson.added_tokens;
  if (!Array.isArray(added)) return [];
  return added
    .filter((t): t is { id: number; content: string; special?: boolean } => typeof t?.id === "number" && typeof t?.content === "string")
    .filter((t) => t.special === true)
    .map((t) => ({ id: t.id, content: t.content }));
}

/** Thin wrapper around `@huggingface/tokenizers` (0.x API) that hides its quirks from the rest of the code. */
export class LensTokenizer {
  private readonly tok: Tokenizer;
  readonly specialTokens: Array<{ id: number; content: string }>;
  readonly addsBos: boolean;

  constructor(private readonly bundle: TemplateBundle) {
    try {
      this.tok = new Tokenizer(bundle.tokenizerJson, bundle.tokenizerConfig);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`tokenizer.json / tokenizer_config.json could not be loaded: ${reason}`);
    }
    this.specialTokens = bundleSpecialTokens(bundle);
    this.addsBos = postProcessorAddsBos(bundle);
  }

  /** Tokenize rendered chat text. `add_special_tokens` is false because the template already wrote BOS. */
  encode(text: string): Encoded {
    const ids = this.tok.encode(text, { add_special_tokens: false }).ids;
    return { ids, ends: this.tokenEnds(ids, text) };
  }

  private decode(ids: number[]): string {
    return this.tok.decode(ids, { skip_special_tokens: false });
  }

  /** Map tokens to character positions. `@huggingface/tokenizers` 0.2.0 returns no offsets, so decode pieces. */
  private tokenEnds(ids: number[], text: string): number[] {
    const ends: number[] = new Array<number>(ids.length);
    let pos = 0;
    let k = 0;
    let ok = true;
    while (k < ids.length && ok) {
      let j = k;
      let piece = this.decode(ids.slice(k, j + 1));
      // A token inside a multi-byte character decodes to U+FFFD: keep extending until the character is complete.
      while (piece.endsWith(REPLACEMENT) && j + 1 < ids.length && j - k < MAX_GROUP) {
        j++;
        piece = this.decode(ids.slice(k, j + 1));
      }
      if (text.slice(pos, pos + piece.length) !== piece) {
        ok = false;
        break;
      }
      pos += piece.length;
      for (let t = k; t <= j; t++) ends[t] = pos;
      k = j + 1;
    }
    if (ok && pos === text.length) return ends;
    return this.prefixEnds(ids, text.length);
  }

  /** Slow but robust fallback: end of token k is the length of the decoded prefix. Clamped to the text length. */
  private prefixEnds(ids: number[], textLength: number): number[] {
    const ends: number[] = [];
    let last = 0;
    for (let k = 1; k <= ids.length; k++) {
      last = Math.max(last, Math.min(this.decode(ids.slice(0, k)).length, textLength));
      ends.push(last);
    }
    return ends;
  }
}

function postProcessorAddsBos(bundle: TemplateBundle): boolean {
  const pp = bundle.tokenizerJson.post_processor;
  if (!pp) return false;
  const bos = bundle.tokenizerConfig.bos_token;
  const bosText = typeof bos === "string" ? bos : (bos as { content?: string } | null)?.content;
  if (!bosText) return false;
  return JSON.stringify(pp).includes(JSON.stringify(bosText));
}
