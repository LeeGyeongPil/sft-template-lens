// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "../../src/ui/App";
import { formatHash, parseHash } from "../../src/ui/hashState";

// AC-10 (UI part): the app loads the bundled demo and draws summary cards, issue table, token view and the mock banner.
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("App", () => {
  test("loads the demo and shows banner, summary cards, issue table and a colored token view", async () => {
    window.location.hash = "#template=smollm2&sample=1&max=256";
    render(<App />);
    const cards = await screen.findByLabelText("Summary", {}, { timeout: 30000 });
    expect(within(cards).getByText("Samples")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("Practice (mock) mode");

    // max=256 from the URL hash: the long-prompt sample (line 4) is E005
    const table = screen.getByRole("table");
    expect(within(table).getAllByText(/E005/).length).toBeGreaterThan(0);

    const tokens = screen.getByTestId("tokens");
    expect(tokens.querySelectorAll(".chip.train").length).toBeGreaterThan(0);
    expect(tokens.querySelectorAll(".chip.masked").length).toBeGreaterThan(0);
    expect(tokens.querySelectorAll(".chip.special").length).toBeGreaterThan(0);
    expect(screen.getByText(/Mask approximate/)).toBeTruthy();

    // selecting the truncated sample shows hatched (cut) chips
    fireEvent.click(within(table).getAllByText(/Line 4: all/)[0]!);
    expect(screen.getByTestId("tokens").querySelectorAll(".chip.cut").length).toBeGreaterThan(0);
  }, 60000);

  test("a template with generation markers shows the exact-mask badge", async () => {
    window.location.hash = "#template=smollm3&sample=1";
    render(<App />);
    await screen.findByLabelText("Summary", {}, { timeout: 30000 });
    expect(await screen.findByText(/Mask exact/)).toBeTruthy();
  }, 60000);

  test("hash state round-trips", () => {
    const state = { template: "qwen3", sample: 2, max: 512, view: "text" as const };
    expect(parseHash(formatHash(state))).toEqual(state);
    expect(parseHash("#sample=abc")).toMatchObject({ sample: 1, template: "smollm2" });
  });
});
