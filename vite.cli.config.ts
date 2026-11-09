import { defineConfig } from "vite";

// Node CLI bundle: dist-cli/cli.mjs (fixtures are inlined through ?raw imports).
export default defineConfig({
  build: {
    ssr: "src/cli/main.ts",
    outDir: "dist-cli",
    target: "node22",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "cli.mjs", format: "es", banner: "#!/usr/bin/env node" } },
  },
  ssr: { noExternal: true },
});
