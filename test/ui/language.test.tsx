// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LANG_STORAGE_KEY } from "../../src/i18n";
import { App } from "../../src/ui/App";

// The web language menu: English / 한국어, saved in localStorage, <html lang> follows, first run uses the browser language.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("language menu", () => {
  test("switching to Korean and back changes labels, <html lang> and the saved value", async () => {
    render(<App />);
    const cards = await screen.findByLabelText("Summary", {}, { timeout: 30000 });
    expect(within(cards).getByText("Samples")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");

    const menu = screen.getByLabelText("Language") as HTMLSelectElement;
    expect([...menu.options].map((o) => o.textContent)).toEqual(["English", "한국어"]);
    fireEvent.change(menu, { target: { value: "ko" } });
    expect(within(await screen.findByLabelText("요약")).getByText("샘플 수")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("연습용 데모(목)");
    expect(document.documentElement.lang).toBe("ko");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("ko");
    // rule names come from the RULES ko field in the issue table filter
    expect(within(screen.getByLabelText("규칙 필터")).getAllByRole("option").some((o) => /JSON 파싱 실패/.test(o.textContent ?? ""))).toBe(true);

    fireEvent.change(screen.getByLabelText("언어"), { target: { value: "en" } });
    expect(within(await screen.findByLabelText("Summary")).getByText("Errors")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(within(screen.getByLabelText("Rule filter")).getAllByRole("option").some((o) => /Line is not valid JSON/.test(o.textContent ?? ""))).toBe(true);
  }, 60000);

  test("a saved choice is restored on the next start", async () => {
    localStorage.setItem(LANG_STORAGE_KEY, "ko");
    render(<App />);
    expect(await screen.findByLabelText("요약", {}, { timeout: 30000 })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ko");
    expect((screen.getByLabelText("언어") as HTMLSelectElement).value).toBe("ko");
  }, 60000);

  test("first run without a saved value follows navigator.language (ko -> Korean, anything else -> English)", async () => {
    localStorage.clear();
    vi.stubGlobal("navigator", { ...window.navigator, language: "ko-KR" });
    render(<App />);
    expect(await screen.findByLabelText("요약", {}, { timeout: 30000 })).toBeTruthy();
    cleanup();

    localStorage.clear();
    vi.stubGlobal("navigator", { ...window.navigator, language: "de-DE" });
    render(<App />);
    expect(await screen.findByLabelText("Summary", {}, { timeout: 30000 })).toBeTruthy();
  }, 90000);
});

describe("errors follow the language", () => {
  test("an empty file shows the Korean error and re-translates when the language is switched", async () => {
    localStorage.setItem(LANG_STORAGE_KEY, "ko");
    const { container } = render(<App />);
    await screen.findByLabelText("요약", {}, { timeout: 30000 });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([""], "empty.jsonl")] } });
    const alert = await screen.findByRole("alert", {}, { timeout: 30000 });
    expect(alert.textContent).toContain("JSONL 행이 없습니다");
    fireEvent.change(screen.getByLabelText("언어"), { target: { value: "en" } });
    expect(screen.getByRole("alert").textContent).toContain("The file has no JSONL rows");
  }, 90000);

  test("the progress text uses the current language, not the language it was started in", async () => {
    localStorage.setItem(LANG_STORAGE_KEY, "en");
    render(<App />);
    expect(screen.getByText(/^Checking…/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ko" } });
    expect(screen.queryByText(/^Checking…/)).toBeNull();
    expect(screen.getByText(/^검사 중…/)).toBeTruthy();
    await screen.findByLabelText("요약", {}, { timeout: 30000 });
  }, 60000);
});
