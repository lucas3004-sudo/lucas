import { describe, expect, it } from "vitest";
import { trustedOrigins } from "./env";

describe("adresses autorisées pour l'authentification", () => {
  it("adresse principale + adresses propres au déploiement Vercel et à sa branche", () => {
    expect(trustedOrigins({
      VERCEL_PROJECT_PRODUCTION_URL: "lucas-abc.vercel.app",
      VERCEL_URL: "lucas-nnwqx9u3h-equipe-projects.vercel.app",
      VERCEL_BRANCH_URL: "lucas-git-main-equipe-projects.vercel.app",
    })).toEqual([
      "https://lucas-abc.vercel.app",
      "https://lucas-nnwqx9u3h-equipe-projects.vercel.app",
      "https://lucas-git-main-equipe-projects.vercel.app",
    ]);
  });

  it("ajouts manuels en https seulement, jamais de joker ni de chemin", () => {
    expect(trustedOrigins({
      BETTER_AUTH_URL: "https://app.immopilot.fr/",
      AUTH_TRUSTED_ORIGINS: "https://www.immopilot.fr, http://non-chiffre.fr, https://*.vercel.app, https://x.fr/chemin",
    })).toEqual(["https://app.immopilot.fr", "https://www.immopilot.fr"]);
  });

  it("en local : le poste de développement", () => {
    expect(trustedOrigins({})).toEqual(["http://localhost:3000"]);
  });
});
