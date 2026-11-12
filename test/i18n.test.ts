import { describe, expect, test } from "vitest";
import { RULES } from "../src/core/checks";
import { LANGS, langFromLocale, MESSAGES, resolveCliLang, resolveWebLang, ruleLabel, tokenCount, type Messages } from "../src/i18n";

describe("message table", () => {
  test("English and Korean define exactly the same keys, with the same kind of value", () => {
    expect(Object.keys(MESSAGES.ko).sort()).toEqual(Object.keys(MESSAGES.en).sort());
    for (const key of Object.keys(MESSAGES.en) as Array<keyof Messages>) {
      expect(typeof MESSAGES.ko[key], key).toBe(typeof MESSAGES.en[key]);
    }
  });

  test("every message is non-empty in both languages", () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(MESSAGES[lang])) {
        const text = typeof value === "function" ? (value as (...a: unknown[]) => string)(["x", "y"], ["x", "y"], ["x", "y"], ["x", "y"]) : value;
        expect(String(text).length, `${lang}: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  test("a missing key is a compile-time error (checked by `npm run typecheck`)", () => {
    const { histTitle: _omitted, ...rest } = MESSAGES.en;
    // @ts-expect-error -- histTitle is missing, so this is not a Messages
    const broken: Messages = rest;
    expect(broken).toBeDefined();
  });

  test("rule labels come from RULES en/ko and english counts split singular and plural", () => {
    expect(ruleLabel(RULES[0]!, "en")).toBe(RULES[0]!.en);
    expect(ruleLabel(RULES[0]!, "ko")).toBe(RULES[0]!.ko);
    expect(tokenCount(MESSAGES.en, 1)).toBe("1 token");
    expect(tokenCount(MESSAGES.en, 2)).toBe("2 tokens");
    expect(tokenCount(MESSAGES.ko, 1)).toBe("토큰 1개");
  });
});

describe("language resolution", () => {
  test("locale strings: ko* is Korean, everything else (including junk) is English", () => {
    expect(langFromLocale("ko_KR.UTF-8")).toBe("ko");
    expect(langFromLocale("ko-KR")).toBe("ko");
    expect(langFromLocale("en_US.UTF-8")).toBe("en");
    expect(langFromLocale("ja_JP")).toBe("en");
    expect(langFromLocale("")).toBe("en");
    expect(langFromLocale(undefined)).toBe("en");
  });

  test("CLI order is --lang > SFT_TEMPLATE_LENS_LANG > LC_ALL > LC_MESSAGES > LANG", () => {
    const all = { SFT_TEMPLATE_LENS_LANG: "ko", LC_ALL: "en_US", LC_MESSAGES: "en_US", LANG: "en_US" };
    expect(resolveCliLang("en", all)).toBe("en");
    expect(resolveCliLang(undefined, all)).toBe("ko");
    expect(resolveCliLang(undefined, { LC_ALL: "ko_KR", LC_MESSAGES: "en_US", LANG: "en_US" })).toBe("ko");
    expect(resolveCliLang(undefined, { LC_ALL: "", LC_MESSAGES: "ko_KR", LANG: "en_US" })).toBe("ko");
    expect(resolveCliLang(undefined, { LANG: "ko_KR.UTF-8" })).toBe("ko");
    expect(resolveCliLang(undefined, { LANG: "fr_FR" })).toBe("en");
    expect(resolveCliLang(undefined, {})).toBe("en");
  });

  test("web: a saved choice wins; only without one the browser language decides", () => {
    expect(resolveWebLang("en", "ko-KR")).toBe("en");
    expect(resolveWebLang("ko", "en-US")).toBe("ko");
    expect(resolveWebLang(null, "ko-KR")).toBe("ko");
    expect(resolveWebLang(null, "de-DE")).toBe("en");
    expect(resolveWebLang("zz", "ko")).toBe("ko");
  });
});
