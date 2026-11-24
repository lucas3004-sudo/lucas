/**
 * Tests de bout en bout des fonctions d'IA (D-069) : le site tourne sur un autre port, avec une
 * clé factice et l'adresse d'un faux serveur d'IA local (aucun appel réel, aucun coût). Les
 * autres tests (playwright.config.ts) gardent l'IA éteinte, comme sans clé.
 */
import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e-ia",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "off", locale: "fr-FR", timezoneId: "Europe/Paris" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node e2e-ia/mock-anthropic.mjs", url: "http://127.0.0.1:3999/__sante", reuseExistingServer: false, timeout: 30_000 },
    {
      command: `pnpm exec next start -p ${port}`,
      url: `${baseURL}/connexion`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ANTHROPIC_API_KEY: "cle-factice-pour-les-tests",
        ANTHROPIC_BASE_URL: "http://127.0.0.1:3999",
        BETTER_AUTH_URL: baseURL,
        AI_MONTHLY_BUDGET_USD: "5",
        AUTH_RATE_LIMIT_SIGNUP: "50",
        AUTH_RATE_LIMIT_SIGNIN: "100",
      },
    },
  ],
});
