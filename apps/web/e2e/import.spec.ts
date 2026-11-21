/**
 * Import CSV de bout en bout (F4, F5) : fichier Excel en Windows-1252, aperçu ligne par ligne,
 * doublons et erreurs écartés, import confirmé, réimport sans création de doublon ;
 * biens vérifiés auprès de la Base Adresse Nationale.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const email = `elodie-${run}@test.invalid`;

test("un gérant importe ses contacts puis ses biens depuis des fichiers CSV", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Iris Import");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`import-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Import ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Iris" })).toBeVisible();

  // Contacts : export Excel français (point-virgule, Windows-1252).
  const contactsCsv = [
    "Prénom;Nom;Courriel;Téléphone;Type;Fax",
    `Élodie;Dupré;${email};06 12 34 56 78;Acheteur;`,
    `Élodie;Dupré;${email.toUpperCase()};;;`,
    ";Martin;pas-un-email;;;",
  ].join("\r\n");
  const file = { name: "contacts.csv", mimeType: "text/csv", buffer: Buffer.from(contactsCsv, "latin1") };

  await page.getByRole("link", { name: "Contacts" }).first().click();
  await page.getByRole("link", { name: "Importer (CSV)" }).click();
  await expect(page.getByText(/consentements de prospection ne sont pas importés/)).toBeVisible();
  await page.getByLabel("Fichier CSV").setInputFiles(file);
  await page.getByRole("button", { name: "Vérifier le fichier" }).click();
  await expect(page.getByText("1 à importer")).toBeVisible();
  await expect(page.getByText("1 doublon(s)")).toBeVisible();
  await expect(page.getByText("1 erreur(s)")).toBeVisible();
  await expect(page.getByText(/Encodage Windows \(Excel\) détecté/)).toBeVisible();
  await expect(page.getByText(/Colonnes ignorées : Fax/)).toBeVisible();
  await expect(page.getByText("Répété dans le fichier (ligne 2).")).toBeVisible();
  await expect(page.getByText("E-mail invalide : « pas-un-email ».")).toBeVisible();
  await page.getByRole("button", { name: "Importer 1 contacts" }).click();
  await expect(page.getByText("1 contact(s) importé(s).")).toBeVisible();
  await page.getByRole("link", { name: "Voir les contacts" }).click();
  await expect(page.getByRole("link", { name: /Élodie Dupré/ })).toBeVisible();

  // Réimport du même fichier : rien de nouveau, les doublons sont reconnus.
  await page.goto("/app/contacts/import");
  await page.getByLabel("Fichier CSV").setInputFiles(file);
  await page.getByRole("button", { name: "Vérifier le fichier" }).click();
  await expect(page.getByText("0 à importer")).toBeVisible();
  await expect(page.getByText("2 doublon(s)")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Importer/ })).toHaveCount(0);

  // Biens : chaque adresse est vérifiée auprès de la BAN.
  const propertiesCsv = [
    "Adresse,Code postal,Ville,Type,Surface,Pièces,Prix,Équipements",
    '8 boulevard du Port,80000,Amiens,Appartement,"62,5",3,250000,balcon',
    "1 rue des Exemples,80000,Amiens,Local commercial,40,,,",
  ].join("\n");
  await page.goto("/app/proprietes/import");
  await page.getByLabel("Fichier CSV").setInputFiles({ name: "biens.csv", mimeType: "text/csv", buffer: Buffer.from(propertiesCsv, "utf-8") });
  await page.getByRole("button", { name: "Vérifier le fichier" }).click();
  await expect(page.getByText("1 à importer")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "8 Boulevard du Port 80000 Amiens" })).toBeVisible();
  await expect(page.getByText(/Type de bien non pris en charge : « Local commercial »/)).toBeVisible();
  await page.getByRole("button", { name: "Importer 1 biens" }).click();
  await expect(page.getByText("1 bien(s) importé(s).")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Voir les biens" }).click();
  await expect(page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ })).toBeVisible();

  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Contacts importés (CSV)", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Biens importés (CSV)", exact: true })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
});
