import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

// One self-contained dist/index.html (JS, CSS, demo data and the bundled tokenizer inlined) so it opens from file://.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: { target: "es2022", chunkSizeWarningLimit: 6000 },
  test: {
    environment: "node",
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    testTimeout: 60000,
  },
});
