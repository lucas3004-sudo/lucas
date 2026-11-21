/**
 * Double authentification de bout en bout : activation avec une application (code TOTP calculé
 * ici selon la RFC 6238), connexion en deux étapes, code incorrect refusé, code de secours.
 */
import { expect, test, type Page } from "@playwright/test";
import { totp } from "./helpers/totp";

const run = Date.now().toString(36);
const email = `deux-etapes-${run}@test.invalid`;
const password = "motdepasse-de-test-1234";

async function signIn(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("un gérant active la double authentification puis se connecte en deux étapes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Gaspard Sécurité");
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Sécurité ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByText(/activez la double authentification/)).toBeVisible();

  await page.getByRole("link", { name: "Activer", exact: true }).click();
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Activer la double authentification" }).click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  const backupCode = (await page.getByTestId("backup-codes").locator("li").first().textContent())!.trim();
  await page.getByLabel("Code de l'application").fill(await totp(secret));
  await page.getByRole("button", { name: "Terminer l'activation" }).click();
  await expect(page.getByText("Double authentification activée.", { exact: false })).toBeVisible();
  await expect(page.getByText("Activée", { exact: true })).toBeVisible();
  await expect(page.getByText(/activez la double authentification/)).toHaveCount(0);

  // Connexion : le mot de passe ne suffit plus.
  await page.context().clearCookies();
  await signIn(page);
  await expect(page).toHaveURL(/\/connexion\/verification/);
  await page.getByLabel("Code de vérification").fill("000000");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Code incorrect.")).toBeVisible();
  await page.getByLabel("Code de vérification").fill(await totp(secret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Gaspard" })).toBeVisible();

  // Sans téléphone : un code de secours.
  await page.context().clearCookies();
  await signIn(page);
  await expect(page).toHaveURL(/\/connexion\/verification/);
  await page.getByRole("button", { name: "Utiliser un code de secours" }).click();
  await page.getByLabel("Code de secours").fill(backupCode);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Gaspard" })).toBeVisible();

  // Les pages de l'agence restent inaccessibles sans la seconde étape.
  await page.context().clearCookies();
  await signIn(page);
  await expect(page).toHaveURL(/\/connexion\/verification/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/connexion$/);
});
