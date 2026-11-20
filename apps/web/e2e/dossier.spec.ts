/**
 * Dossier de bien de bout en bout (critères F2 et F3), sur une VRAIE adresse :
 * 8 boulevard du Port, 80000 Amiens (adresse témoin de la Base Adresse Nationale).
 *
 * E2E_EXPECT_DVF=1 : les ventes DVF de la Somme sont chargées (base locale) → une fourchette
 * d'estimation est exigée. Sinon (CI), le dossier doit afficher « Manquante » avec la raison,
 * sans jamais inventer de chiffre.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const password = "motdepasse-de-test-1234";
const expectDvf = process.env.E2E_EXPECT_DVF === "1";

test("un négociateur crée un dossier de bien sourcé depuis une adresse", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Nina Dossier");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`dossier-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Dossier ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Nina" })).toBeVisible();

  await page.getByRole("link", { name: "Dossiers de biens" }).first().click();
  await expect(page.getByText("Aucun dossier pour le moment.")).toBeVisible();
  await page.getByRole("link", { name: "Nouveau dossier" }).click();

  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Type de bien").selectOption("Appartement");
  await page.getByLabel("Surface habitable (m²)").fill("60");
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByRole("button", { name: "Créer le dossier" }).click();

  await expect(page.getByRole("heading", { name: "8 Boulevard du Port 80000 Amiens" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Estimation indicative, pas une expertise.")).toBeVisible();

  // Données vérifiées, quel que soit l'environnement : zonage et risques (Géorisques interrogé en direct).
  await expect(page.getByText(/Zone\s+B1\s+du zonage ABC/)).toBeVisible().catch(async () => {
    await expect(page.getByText("Zonage non trouvé (ou données non chargées).")).toBeVisible();
  });
  const risks = page.getByRole("cell", { name: "Inondation", exact: true });
  const risksMissing = page.getByText(/Source Géorisques momentanément indisponible/);
  await expect(risks.or(risksMissing)).toBeVisible();

  if (expectDvf) {
    await expect(page.getByText(/€ – .*€/).first()).toBeVisible();
    await expect(page.getByText(/Confiance (élevée|moyenne|faible)/)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Prix au m²" })).toBeVisible();
  } else {
    await expect(page.getByText(/ne sont pas encore chargées dans cet environnement/).first()).toBeVisible();
  }

  // Le dossier apparaît dans la liste et dans le journal d'audit.
  await page.getByRole("link", { name: "Dossiers de biens" }).first().click();
  await expect(page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ })).toBeVisible();
  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Dossier de bien créé", exact: true })).toBeVisible();
});
