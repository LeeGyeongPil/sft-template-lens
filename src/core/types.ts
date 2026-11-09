/** Shared types for the inspection engine (no DOM, no Node APIs). */

export interface Message {
  role: string;
  content: string;
}

export type DataFormat = "openai" | "sharegpt" | "alpaca";

export type Severity = "error" | "warning";

export interface Sample {
  /** 1-based line number in the source file. */
  line: number;
  format: DataFormat;
  messages: Message[];
}

export interface Issue {
  /** Rule id such as `E005` or `W101`. See `checks.ts`. */
  rule: string;
  severity: Severity;
  /** 1-based source line, or `null` for template-level / dataset-level findings. */
  line: number | null;
  message: string;
}

export type TemplateSource = "bundled" | "hub" | "local";

/** Everything needed to turn messages into tokens for one model. */
export interface TemplateBundle {
  id: string;
  label: string;
  source: TemplateSource;
  /** True for the offline practice (mock) bundle. */
  mock: boolean;
  /** Jinja chat template text. */
  template: string;
  tokenizerJson: Record<string, unknown>;
  tokenizerConfig: Record<string, unknown>;
}

export type MaskStrategy = "exact-generation" | "approx-content" | "none";

export interface InspectOptions {
  /** Right-truncation limit in tokens. Default 2048. */
  maxSeqLen?: number;
  /** Fixed date used by `strftime_now` / `date_string`, `YYYY-MM-DD`. Default 2026-01-01. */
  date?: string;
}

export interface SampleResult {
  line: number;
  format: DataFormat | null;
  messages: Message[];
  /** Rendered chat text (null when parsing or rendering failed). */
  text: string | null;
  ids: number[];
  /** Exclusive end character index of every token in `text` (see `tokenize.ts`). */
  ends: number[];
  /** 1 when the token is trained on (before truncation). */
  mask: number[];
  /** False when the mask could not be computed (W111) or nothing was rendered. */
  maskValid: boolean;
  tokenCount: number;
  trainTokens: number;
  /** Tokens kept after right truncation at `maxSeqLen`. */
  keptTokens: number;
  trainTokensAfterTruncation: number;
  issues: Issue[];
}

export interface TemplateInfo {
  id: string;
  label: string;
  mock: boolean;
  source: TemplateSource;
  maskStrategy: MaskStrategy;
  /** Template-level findings (W105, W106, W107, W108, W110). */
  issues: Issue[];
  specialTokenIds: number[];
}

export interface Summary {
  samples: number;
  errors: number;
  warnings: number;
  samplesWithErrors: number;
  trainTokenRatio: number;
  zeroTrainAfterTruncation: number;
  ruleCounts: Record<string, number>;
}

export interface Report {
  template: TemplateInfo;
  options: Required<InspectOptions>;
  results: SampleResult[];
  /** Dataset-level findings (for example mixed formats). */
  datasetIssues: Issue[];
  summary: Summary;
}
