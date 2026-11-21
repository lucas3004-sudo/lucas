/**
 * Fiche annonce de bout en bout : contrôle des mentions obligatoires, copie bloquée tant qu'il
 * en manque, texte produit sans IA à partir des données du bien.
 */
import path from "node:path";
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);

test("un gérant complète l'annonce d'un bien jusqu'à ce que toutes les mentions soient présentes", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Ana Annonce");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`annonce-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Annonce ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Ana" })).toBeVisible();

  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Surface habitable (m²)").fill("62");
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByLabel("Prix affiché (€)").fill("250000");
  await page.getByLabel("Classe DPE").selectOption("F");
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: "8 Boulevard du Port 80000 Amiens" })).toBeVisible({ timeout: 20_000 });

  // Photos : une vraie image PNG, réduite et convertie en JPEG par le navigateur, revérifiée par le serveur.
  const propertyPath = new URL(page.url()).pathname;
  await page.getByLabel("Ajouter des photos").setInputFiles(path.join(process.cwd(), "../../docs/captures/01-connexion.png"));
  await expect(page.getByText("Photo ajoutée.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Photos (1)" })).toBeVisible();
  const img = page.getByRole("img", { name: "Photo 1 du bien" });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const photo = await page.request.get((await img.getAttribute("src"))!);
  expect(photo.headers()["content-type"]).toBe("image/jpeg");
  expect(photo.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await photo.body()).includes(Buffer.from("Exif"))).toBe(false);
  // Un visiteur non connecté n'obtient pas la photo.
  const anonymous = await page.context().browser()!.newContext();
  const denied = await anonymous.request.get(new URL((await img.getAttribute("src"))!, page.url()).toString(), { maxRedirects: 0 });
  expect(denied.status()).not.toBe(200);
  await anonymous.close();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer la photo 1" }).click();
  await expect(page.getByRole("heading", { name: "Photos (0)" })).toBeVisible();
  await page.goto(propertyPath);

  await page.getByRole("link", { name: "Annonce", exact: true }).click();
  await expect(page.getByText("5 manquante(s)")).toBeVisible();
  await expect(page.getByText(/Copie bloquée tant que 5 mention/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier l'annonce" })).toHaveCount(0);

  await page.getByLabel("Description").fill("Lumineux, au calme, proche de la gare.");
  await page.getByLabel("Classe climat (GES)").selectOption("E");
  await page.getByLabel("Dépenses d'énergie : fourchette basse (€ / an)").fill("1900");
  await page.getByLabel("Dépenses d'énergie : fourchette haute (€ / an)").fill("2600");
  await page.getByLabel("Année de référence des prix de l'énergie").fill("2025");
  await page.getByLabel("Bien en copropriété").selectOption("oui");
  await page.getByLabel("Nombre de lots").fill("24");
  await page.getByLabel("Charges annuelles moyennes (€)").fill("1800");
  await page.getByLabel("À la charge de").selectOption("acquereur");
  await page.getByLabel("Honoraires TTC (% du prix hors honoraires)").fill("5");
  await page.getByRole("button", { name: "Enregistrer et contrôler" }).click();
  await expect(page.getByText("Annonce enregistrée.", { exact: false })).toBeVisible();
  await expect(page.getByText("1 manquante(s)")).toBeVisible(); // il ne manque plus que le barème

  // Barème des honoraires : paramètre de l'agence.
  await page.goto("/app/parametres");
  await page.getByLabel("Lien vers le barème des honoraires").fill("https://agence.example/honoraires");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

  await page.goBack();
  await page.reload();
  await expect(page.getByText("Complète")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier l'annonce" })).toBeVisible();
  const text = page.getByTestId("listing-text");
  await expect(text).toContainText("Lumineux, au calme, proche de la gare.");
  await expect(text).toContainText("Prix : 250 000 € honoraires inclus, dont 5 % TTC d'honoraires à la charge de l'acquéreur (238 095 € hors honoraires).");
  await expect(text).toContainText("classe énergie F, classe climat E");
  await expect(text).toContainText("Logement à consommation énergétique excessive");
  await expect(text).toContainText("Nombre de lots : 24.");
  await expect(text).toContainText("www.georisques.gouv.fr");
  if (process.env.E2E_CAPTURES) {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.screenshot({ path: `${process.env.E2E_CAPTURES}/15-annonce.png`, fullPage: true });
  }
});
