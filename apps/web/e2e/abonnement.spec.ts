/**
 * Page d'accueil publique, essai gratuit de 14 jours et page d'abonnement (D-057).
 * Sans clé Stripe (CI), le paiement est annoncé « en cours d'activation » et les boutons sont inactifs.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);

test("un visiteur découvre ImmoPilot, démarre l'essai gratuit et voit les formules", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Toute votre agence/ })).toBeVisible();
  await page.locator("#tarifs").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Des tarifs simples." })).toBeVisible();
  for (const [name, price] of [["Solo", "59 €"], ["Pro", "99 €"], ["Agency", "249 €"]] as const) {
    await expect(page.locator("#tarifs").getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.locator("#tarifs").getByText(price, { exact: true })).toBeVisible();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "Démarrer l'essai gratuit" }).click();
  await expect(page).toHaveURL(/\/inscription$/);
  await page.getByLabel("Nom et prénom").fill("Paula Paiement");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`abonnement-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Abonnement ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Paula" })).toBeVisible();

  // Essai gratuit : le gérant voit les jours restants.
  await expect(page.getByText("Essai gratuit : 14 jour(s) restant(s).")).toBeVisible();
  await page.getByRole("link", { name: "Choisir une formule" }).click();
  await expect(page.getByRole("heading", { name: `Abonnement de Agence Abonnement ${run}` })).toBeVisible();
  await expect(page.getByText(/Essai gratuit : 14 jour\(s\) restant\(s\), jusqu'au/)).toBeVisible();
  await expect(page.getByText("Le paiement en ligne est en cours d'activation.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choisir Pro" })).toBeDisabled();

  // Connecté, la page d'accueil mène au logiciel.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Ouvrir ImmoPilot" }).first()).toBeVisible();

  // Webhook Stripe : sans configuration, refus explicite (aucun traitement).
  expect((await page.request.post("/api/v1/stripe/webhook", { data: "{}" })).status()).toBe(503);
});
