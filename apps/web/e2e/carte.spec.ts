/**
 * Carte des biens : biens de l'agence filtrés par critères, repère « bonne affaire » (médiane DVF
 * de la commune), ventes réelles de la zone affichée via l'API (sans adresse).
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const expectDvf = process.env.E2E_EXPECT_DVF === "1";
const address = "8 Boulevard du Port 80000 Amiens";

test("un négociateur cherche sur la carte les biens selon ses critères et repère les bonnes affaires", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Clara Carte");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`carte-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Carte ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Clara" })).toBeVisible();

  // Un appartement affiché à 1 935 €/m² (la médiane d'Amiens est d'environ 2 500 €/m²).
  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Surface habitable (m²)").fill("62");
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByLabel("Prix affiché (€)").fill("120000");
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Carte" }).first().click();
  await expect(page.getByRole("heading", { name: "Carte des biens" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Carte des biens de l'agence et des ventes réelles" })).toBeVisible();
  await expect(page.locator("path.leaflet-interactive").first()).toBeAttached(); // le bien est placé sur la carte
  await expect(page.getByRole("heading", { name: "1 bien(s) correspondant(s), les meilleures affaires d'abord" })).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: address });
  await expect(item.getByRole("link", { name: address })).toBeVisible();

  if (expectDvf) {
    await expect(item.getByText(/^Sous le marché \(−\d+ %\)$/)).toBeVisible();
    await page.getByLabel("Bonnes affaires seulement").check();
    await expect(page.getByRole("heading", { name: "1 bien(s) correspondant(s), les meilleures affaires d'abord" })).toBeVisible();
    await page.getByLabel("Bonnes affaires seulement").uncheck();
  } else {
    await expect(item.getByText("Pas assez de ventes pour comparer")).toBeVisible();
  }

  // Critères : un prix maximum trop bas écarte le bien, la surface minimale aussi.
  await page.getByLabel("Prix maximum (€)").fill("100000");
  await expect(page.getByText("Aucun bien ne correspond à ces critères.")).toBeVisible();
  await page.getByLabel("Prix maximum (€)").fill("");
  await page.getByLabel("Surface minimum (m²)").fill("80");
  await expect(page.getByText("Aucun bien ne correspond à ces critères.")).toBeVisible();
  await page.getByLabel("Surface minimum (m²)").fill("");
  await expect(item).toBeVisible();

  // Ventes réelles de la zone : jamais d'adresse, zone contrôlée.
  const sales = await page.request.get("/api/v1/carte/ventes?bbox=2.28,49.88,2.32,49.91");
  expect(sales.status()).toBe(200);
  const body = (await sales.json()) as { sales: Array<Record<string, unknown>> };
  if (expectDvf) expect(body.sales.length).toBeGreaterThan(0);
  for (const s of body.sales.slice(0, 5)) expect(Object.keys(s).sort()).toEqual(["date", "lat", "lon", "price", "pricePerSqm", "surface", "type"]);
  expect((await page.request.get("/api/v1/carte/ventes?bbox=pas,une,zone,valide")).status()).toBe(400);
  expect(await (await page.request.get("/api/v1/carte/ventes?bbox=1,45,3,47")).json()).toEqual({ sales: [], tooWide: true });
});
