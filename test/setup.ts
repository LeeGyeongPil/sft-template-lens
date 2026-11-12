import { beforeEach, vi } from "vitest";
import { LANG_ENV, LANG_STORAGE_KEY } from "../src/i18n";

// Tests must never touch the network: a stray fetch fails loudly. Individual tests inject their own mock fetch.
// The language is pinned to English so the host's LANG / browser language never changes an assertion.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Network access is blocked in tests. Inject a mock fetch instead.");
  });
  process.env[LANG_ENV] = "en"; // inherited by CLI child processes
  if (typeof window !== "undefined") {
    localStorage.clear();
    localStorage.setItem(LANG_STORAGE_KEY, "en");
  }
});
