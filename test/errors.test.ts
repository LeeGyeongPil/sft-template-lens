import { describe, expect, test } from "vitest";
import { parseFixedDate } from "../src/core/dates";
import { inspectDataset } from "../src/core/inspect";
import { buildBundle } from "../src/core/loaders/bundle";
import { loadBundled } from "../src/core/loaders/bundled";
import { loadFromFiles } from "../src/core/loaders/files";
import { GatedModelError, loadFromHub } from "../src/core/loaders/hub";
import { localizeError, MESSAGES } from "../src/i18n";

// Every error the core and the loaders can throw keeps its English text (machine-facing) but is shown in the chosen language.
const catchError = async (fn: () => unknown): Promise<unknown> => {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error("expected the call to throw");
};
const hasHangul = (s: string) => /[가-힣]/.test(s);
const fake = (status: number) => async () => new Response("{}", { status });

describe("localizeError", () => {
  const cases: Array<[string, () => unknown, RegExp]> = [
    ["empty input", () => inspectDataset("", loadBundled("smollm2")), /JSONL 행이 없습니다/],
    ["bad date format", () => parseFixedDate("2026/01/01"), /YYYY-MM-DD 형식/],
    ["date that does not exist", () => parseFixedDate("2026-13-40"), /달력에 없는 날/],
    ["unknown bundled template", () => loadBundled("nope"), /알 수 없는 번들 템플릿 "nope"/],
    ["tokenizer.json not JSON", () => buildBundle("x", "local", { tokenizerJson: "{", tokenizerConfig: "{}" }), /tokenizer\.json 이 올바른 JSON/],
    ["tokenizer_config.json not JSON", () => buildBundle("x", "local", { tokenizerJson: "{}", tokenizerConfig: "{" }), /tokenizer_config\.json 이 올바른 JSON/],
    ["no chat template", () => buildBundle("x", "local", { tokenizerJson: "{}", tokenizerConfig: "{}" }), /채팅 템플릿을 찾지 못했습니다/],
    ["missing local files", () => loadFromFiles([]), /이\(가\) 없습니다/],
    ["bad hub id", () => loadFromHub("nope"), /허브 모델 ID 가 아닙니다/],
    ["gated model", () => loadFromHub("a/b", fake(401)), /접근이 제한/],
    ["model not found", () => loadFromHub("a/b", fake(404)), /HTTP 404/],
    ["hub http failure", () => loadFromHub("a/b", fake(500)), /HTTP 500 로 실패/],
  ];

  test.each(cases)("%s: English stays the original text, Korean is Korean", async (_name, fn, korean) => {
    const error = await catchError(fn);
    const original = (error as Error).message;
    expect(localizeError(error, MESSAGES.en)).toBe(original);
    const ko = localizeError(error, MESSAGES.ko);
    expect(ko).toMatch(korean);
    expect(ko).not.toBe(original);
  });

  test("the date error keeps the offending value", async () => {
    expect(localizeError(await catchError(() => parseFixedDate("2026-13-40")), MESSAGES.ko)).toContain("2026-13-40");
  });

  test("gated error class is mapped too", () => {
    expect(hasHangul(localizeError(new GatedModelError("a/b"), MESSAGES.ko))).toBe(true);
  });

  test("tokenizer and template load failures get a Korean lead sentence and keep the English reason", () => {
    const parse = localizeError(new Error("The chat template could not be parsed: Unexpected token"), MESSAGES.ko);
    expect(parse).toContain("채팅 템플릿을 해석하지 못했습니다");
    expect(parse).toContain("Unexpected token");
    const tok = localizeError(new Error("tokenizer.json / tokenizer_config.json could not be loaded: boom"), MESSAGES.ko);
    expect(tok).toContain("불러오지 못했습니다");
    expect(tok).toContain("boom");
  });

  test("an unknown error gets a Korean lead and the English detail; English is unchanged", () => {
    expect(localizeError(new Error("weird"), MESSAGES.ko)).toMatch(/처리하지 못했습니다.*weird/);
    expect(localizeError(new Error("weird"), MESSAGES.en)).toBe("weird");
    expect(localizeError("plain", MESSAGES.en)).toBe("plain");
  });

  test("option parser errors are mapped by code", () => {
    const unknown = Object.assign(new TypeError("Unknown option '--bogus'. To specify a positional argument, start..."), { code: "ERR_PARSE_ARGS_UNKNOWN_OPTION" });
    expect(localizeError(unknown, MESSAGES.ko)).toBe("알 수 없는 옵션 '--bogus'. --help 를 보세요.");
    expect(localizeError(unknown, MESSAGES.en)).toBe("Unknown option '--bogus'. Try --help.");
    const missing = Object.assign(new TypeError("Option '--lang <value>' argument missing"), { code: "ERR_PARSE_ARGS_INVALID_OPTION_VALUE" });
    expect(localizeError(missing, MESSAGES.ko)).toContain("'--lang' 에 값이 필요합니다");
    expect(localizeError(missing, MESSAGES.en)).toContain("'--lang' needs a value");
    const noArg = Object.assign(new TypeError("Option '--json' does not take an argument"), { code: "ERR_PARSE_ARGS_INVALID_OPTION_VALUE" });
    expect(localizeError(noArg, MESSAGES.ko)).toContain("값을 받지 않습니다");
  });
});
