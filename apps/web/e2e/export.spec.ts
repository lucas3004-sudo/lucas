/**
 * Export complet de l'agence (D-052) : réservé au gérant AVEC double authentification, un CSV par
 * type lisible par Excel (BOM UTF-8, point-virgule), formules neutralisées, export journalisé.
 */
import { expect, test } from "@playwright/test";
import { totp } from "./helpers/totp";

const run = Date.now().toString(36);
const password = "motdepasse-de-test-1234";

test("le gérant exporte les données de l'agence après avoir activé la double authentification", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Eva Export");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`export-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Export ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Eva" })).toBeVisible();

  // Un contact dont les notes contiennent une formule (injection CSV).
  await page.goto("/app/contacts/nouveau");
  await page.getByLabel("Prénom").fill("Élodie");
  await page.getByLabel("Nom", { exact: true }).fill("Dupré; Exportée");
  await page.getByLabel("E-mail").fill(`elodie-${run}@test.invalid`);
  await page.getByLabel("Acquéreur").check();
  await page.getByLabel("Notes").fill("=HYPERLINK(\"http://exemple.invalid\")");
  await page.getByRole("button", { name: "Créer le contact" }).click();
  await expect(page.getByRole("heading", { name: "Élodie Dupré; Exportée" })).toBeVisible();

  // Sans double authentification : pas d'export.
  await page.goto("/app/parametres");
  await expect(page.getByText("activez d'abord la", { exact: false })).toBeVisible();
  expect((await page.request.get("/api/v1/export/contacts")).status()).toBe(403);

  await page.goto("/app/securite");
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Activer la double authentification" }).click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Code de l'application").fill(await totp(secret));
  await page.getByRole("button", { name: "Terminer l'activation" }).click();
  await expect(page.getByText("Double authentification activée.", { exact: false })).toBeVisible();

  await page.goto("/app/parametres");
  await expect(page.getByRole("link", { name: "Contacts (.csv)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Comptes rendus de visite (.csv)" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Contacts (.csv)" }).click();
  expect((await download).suggestedFilename()).toMatch(/^immopilot-contacts-\d{4}-\d{2}-\d{2}\.csv$/);

  const response = await page.request.get("/api/v1/export/contacts");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/csv; charset=utf-8");
  const body = (await response.body()).toString("utf-8");
  expect(body.charCodeAt(0)).toBe(0xfeff); // Excel reconnaît l'UTF-8 (accents)
  const lines = body.slice(1).split("\r\n");
  expect(lines[0]).toBe("Prénom;Nom;E-mail;Téléphone;Rôles;Visibilité;Responsable;Source;Notes;Créé le");
  expect(lines[1]).toContain(`Élodie;"Dupré; Exportée";elodie-${run}@test.invalid;;Acquéreur;`);
  expect(lines[1]).toContain(`"'=HYPERLINK(""http://exemple.invalid"")"`); // formule neutralisée
  expect(lines[1]).toContain("Eva Export");

  for (const dataset of ["biens", "profils", "consentements", "taches", "rendezvous", "affaires", "visites"]) {
    expect((await page.request.get(`/api/v1/export/${dataset}`)).status(), dataset).toBe(200);
  }
  expect((await page.request.get("/api/v1/export/mots-de-passe")).status()).toBe(404);

  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Données de l'agence exportées (CSV)", exact: true }).first()).toBeVisible();
  await expect(page.getByText(`elodie-${run}@test.invalid`)).toHaveCount(0); // le journal ne contient aucune donnée personnelle
});
