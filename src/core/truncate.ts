import type { Issue } from "./types";

export interface TruncationStats {
  keptTokens: number;
  trainAfter: number;
}

/** Right truncation: the first `maxSeqLen` tokens survive, so the last assistant answer is cut first. */
export function truncationStats(mask: number[], maxSeqLen: number): TruncationStats {
  const keptTokens = Math.min(mask.length, maxSeqLen);
  let trainAfter = 0;
  for (let k = 0; k < keptTokens; k++) trainAfter += mask[k]!;
  return { keptTokens, trainAfter };
}

/** E004 / E005 / W101 for one sample, given the trained token counts before and after truncation. */
export function truncationIssues(line: number, trainBefore: number, trainAfter: number, tokenCount: number, maxSeqLen: number): Issue[] {
  if (trainBefore === 0) {
    return [{ rule: "E004", severity: "error", line, message: `Line ${line}: no token is trained on (loss would be 0). Check for assistant messages and the template's markers.` }];
  }
  if (trainAfter === 0) {
    return [
      {
        rule: "E005",
        severity: "error",
        line,
        message: `Line ${line}: all ${trainBefore} trained tokens are cut off at max_seq_length=${maxSeqLen} (sample has ${tokenCount} tokens). Shorten the prompt or raise the limit.`,
      },
    ];
  }
  if (trainAfter < trainBefore) {
    return [
      {
        rule: "W101",
        severity: "warning",
        line,
        message: `Line ${line}: truncation at ${maxSeqLen} tokens loses ${trainBefore - trainAfter} of ${trainBefore} trained tokens.`,
      },
    ];
  }
  return [];
}
