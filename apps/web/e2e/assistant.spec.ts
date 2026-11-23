/**
 * Assistant IA (D-063). Sans clé Anthropic (CI), l'IA est éteinte : la page le dit clairement,
 * l'envoi est impossible, et le guide « Comment faire… » reste utile. Le bouton d'aide flottant
 * mène à l'assistant depuis n'importe quelle page. La consommation d'IA reste « non activée ».
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);

test("l'assistant IA est éteint sans clé, et le guide d'utilisation reste disponible", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Ada Assistant");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`assistant-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Assistant ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Ada" })).toBeVisible();

  await page.getByRole("link", { name: "Besoin d'aide ?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Assistant IA" })).toBeVisible();
  await expect(page.getByText("L'assistant IA n'est pas encore activé. Il le sera très bientôt.")).toBeVisible();
  await expect(page.getByLabel("Votre question")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  // Le bouton d'aide flottant ne s'affiche pas sur la page de l'assistant elle-même.
  await expect(page.getByRole("link", { name: "Besoin d'aide ?" })).toHaveCount(0);

  // Le guide : une réponse concrète et un lien vers la bonne page.
  await page.getByText("Baisser le prix d'un bien", { exact: true }).click();
  await expect(page.getByText(/modifiez « Prix affiché » puis « Modifier le prix »/)).toBeVisible();
  await page.getByText("Ajouter un bien", { exact: true }).click();
  await page.getByRole("link", { name: "Y aller" }).first().click();
  await expect(page.getByRole("heading", { name: "Nouveau bien" })).toBeVisible();

  // Tant que l'IA est éteinte, ses quotas ne sont pas consommés.
  await page.goto("/app/formule");
  await expect(page.getByTestId("usage-copilot")).toHaveText("IA non activée");
});
