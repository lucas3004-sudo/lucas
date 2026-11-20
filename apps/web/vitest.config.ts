import { defineConfig } from "vitest/config";

// Tests unitaires uniquement : les scénarios de bout en bout (e2e/) tournent avec Playwright.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
