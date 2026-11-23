/**
 * Historique et activité d'un bien (D-061) : la base note la création, la mise en vente et la
 * baisse de prix ; la fiche du bien les affiche (durée en vente, évolution du prix, chronologie).
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const address = "8 Boulevard du Port 80000 Amiens";

test("un négociateur baisse le prix d'un bien mis en vente et retrouve tout l'historique sur la fiche", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Hélène Historique");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`historique-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Historique ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Hélène" })).toBeVisible();

  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Surface habitable (m²)").fill("62");
  await page.getByLabel("Prix affiché (€)").fill("250000");
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
  const propertyUrl = new URL(page.url()).pathname;

  // Bien saisi sous mandat (en vente dès sa création), puis baisse de prix et offre reçue.
  await expect(page.getByLabel("Statut du bien")).toHaveValue("mandat");
  await page.getByLabel("Prix affiché (€)").fill("239000");
  await page.getByRole("button", { name: "Modifier le prix" }).click();
  // Attendre la page mise à jour (le prix affiché change), pas seulement la valeur saisie.
  await expect(page.getByTestId("prix-affiche")).toHaveText(/^239\s000\s€/);
  await page.getByLabel("Statut du bien").selectOption("sous_offre");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.getByLabel("Statut du bien")).toHaveValue("sous_offre");

  await page.goto(`${propertyUrl}/fiche`);
  await expect(page.getByRole("heading", { name: "Historique et activité" })).toBeVisible();
  const tiles = page.getByTestId("activite");
  await expect(tiles).toContainText("En vente depuis");
  await expect(tiles).toContainText("0 jour(s)");
  await expect(tiles).toContainText("−4,4 %");
  const timeline = page.getByRole("list", { name: "Chronologie du bien" });
  await expect(timeline.getByText(/^Prix : 250\s000\s€ → 239\s000\s€$/)).toBeVisible();
  await expect(timeline.getByText("Statut : Sous mandat → Sous offre")).toBeVisible();
  await expect(timeline.getByText(/^Bien ajouté, à 250\s000\s€$/)).toBeVisible();

  // Le récap de l'accueil reprend ces événements (24 heures, puis 7 jours).
  await page.goto("/app");
  const recap = page.getByTestId("recap");
  await expect(recap.getByRole("link", { name: "1 bien passé sous offre" })).toBeVisible();
  await expect(recap.getByRole("link", { name: "1 nouveau bien" })).toBeVisible();
  await expect(recap.getByRole("link", { name: "1 baisse de prix" })).toBeVisible();
  await expect(page.getByTestId("recap-titre")).toHaveText("Depuis hier : 1 bien passé sous offre, 1 nouveau bien et 1 baisse de prix.");
  await page.getByRole("link", { name: "7 derniers jours" }).click();
  await expect(page.getByTestId("recap-titre")).toHaveText(/^Cette semaine : /);
  await expect(page.getByRole("link", { name: "7 derniers jours" })).toHaveAttribute("aria-current", "page");

  // La modification est tracée dans le journal d'audit, sans donnée personnelle.
  await page.goto("/app/journal");
  await expect(page.getByText("Prix d'un bien modifié").first()).toBeVisible();
});
