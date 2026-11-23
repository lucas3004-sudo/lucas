/**
 * Formule et quotas (D-048), sans paiement : une nouvelle agence est en Essai, sa consommation
 * est comptée, et l'ajout au-delà du quota est refusé avec un message clair.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);

test("une nouvelle agence est en Essai : consommation affichée, invitation refusée au quota", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Hugo Formule");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`formule-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Formule ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Hugo" })).toBeVisible();

  // Un contact créé : il est compté.
  await page.goto("/app/contacts/nouveau");
  await page.getByLabel("Prénom").fill("Paul");
  await page.getByLabel("Nom", { exact: true }).fill(`Compteur ${run}`);
  await page.getByLabel("Acquéreur").check();
  await page.getByRole("button", { name: "Créer le contact" }).click();
  await expect(page.getByRole("heading", { name: `Paul Compteur ${run}` })).toBeVisible();

  await page.getByRole("link", { name: "Formule" }).first().click();
  await expect(page.getByRole("heading", { name: "Formule et consommation" })).toBeVisible();
  await expect(page.getByText("Votre agence est en essai gratuit.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choisir ou gérer l'abonnement" })).toHaveAttribute("href", "/abonnement");
  await expect(page.getByTestId("usage-contacts")).toHaveText("1 sur 500");
  await expect(page.getByTestId("usage-dossiers")).toHaveText("0 sur 30");
  await expect(page.getByTestId("usage-membres")).toHaveText("1 sur 5");
  await expect(page.getByTestId("usage-copilot")).toHaveText("IA non activée");
  await expect(page.getByRole("progressbar", { name: "Contacts" })).toHaveAttribute("aria-valuenow", "1");

  // Essai : 5 places. Le gérant + 4 invitations en attente = 5 ; la 5e invitation est refusée.
  await page.getByRole("link", { name: "Équipe" }).first().click();
  for (let i = 1; i <= 5; i++) {
    await page.getByLabel("Adresse e-mail").fill(`invite-${i}-${run}@test.invalid`);
    await page.getByLabel("Rôle").selectOption("negociateur");
    await page.getByRole("button", { name: "Créer l'invitation" }).click();
    if (i < 5) {
      await expect(page.getByText(`Invitations en attente (${i})`)).toBeVisible();
    } else {
      await expect(page.getByText("Quota atteint pour la formule Essai (préproduction) : membres de l'agence (5 sur 5).")).toBeVisible();
      await expect(page.getByText("Invitations en attente (4)")).toBeVisible();
    }
  }

  await page.getByRole("link", { name: "Formule" }).first().click();
  await expect(page.getByTestId("usage-membres")).toHaveText("5 sur 5");
  await expect(page.getByText("Quota atteint : les nouveaux ajouts sont refusés.")).toBeVisible();
});
