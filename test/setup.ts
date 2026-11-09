import { beforeEach, vi } from "vitest";

// Tests must never touch the network: a stray fetch fails loudly. Individual tests inject their own mock fetch.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Network access is blocked in tests. Inject a mock fetch instead.");
  });
});
