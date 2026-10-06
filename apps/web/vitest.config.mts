import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  // Shared mocks for every test file (interface language): test/setup.ts.
  test: { setupFiles: ["./test/setup.ts"] },
});
