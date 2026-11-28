/**
 * Import CSV de bout en bout (F4, F5) : fichier Excel en Windows-1252, aperçu ligne par ligne,
 * doublons et erreurs écartés, import confirmé, réimport sans création de doublon ;
 * biens vérifiés auprès de la Base Adresse Nationale.
 */
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

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
  // Fin du mandat dans 15 jours (JJ/MM/AAAA, heure de Paris).
  const endsOn = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(Date.now() + 15 * 86_400_000));
  const propertiesCsv = [
    "Adresse,Code postal,Ville,Type,Surface,Pièces,Prix,Équipements,N° mandat,Fin du mandat",
    `8 boulevard du Port,80000,Amiens,Appartement,"62,5",3,250000,balcon,M-IMP-1,${endsOn}`,
    "1 rue des Exemples,80000,Amiens,Local commercial,40,,,,,",
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
  // Le mandat importé (numéro et date de fin) déclenche le rappel d'échéance.
  await page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await expect(page.getByText("Mandat : fin dans 15 jour(s)")).toBeVisible();
  await expect(page.getByText("M-IMP-1")).toBeVisible();

  // Qualité des données : l'acquéreur importé n'a pas de consentement (jamais importé) ; l'annonce est incomplète.
  await page.getByRole("link", { name: "Qualité des données" }).click();
  await expect(page.getByRole("heading", { name: "Contacts sans consentement de prospection" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Élodie Dupré/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens.*mention\(s\) manquante\(s\)/ })).toBeVisible();

  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Contacts importés (CSV)", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Biens importés (CSV)", exact: true })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
});

test("un gérant importe l'export Poliris (ZIP) de son ancien logiciel : ventes reprises avec leur annonce", async ({ page }) => {
  test.setTimeout(120_000);
  const id = `${Date.now().toString(36)}p`;
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Paul Poliris");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`poliris-${id}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Poliris ${id}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Paul" })).toBeVisible();

  // Deux annonces au format SeLoger « Poliris » (rangs de la spécification 4.09) : une vente, une location.
  const annonce = (values: Record<number, string>) => Array.from({ length: 301 }, (_, i) => `"${values[i + 1] ?? ""}"`).join("!#");
  const vente = { 1: "agence", 2: "VE42", 3: "Vente", 4: "Appartement", 5: "80000", 6: "Amiens", 8: "8 boulevard du Port", 11: "245000", 16: "61", 18: "3", 20: "T3 lumineux près de la gare", 21: "Bel appartement.<BR>Calme.", 41: "OUI", 83: "OUI", 177: "C" };
  const csv = [annonce(vente), annonce({ ...vente, 2: "LO7", 3: "Location" })].join("\r\n");
  const zip = Buffer.from(zipSync({ "Annonces.csv": strToU8(csv), "Config.txt": strToU8("Version=4.09") }));
  await page.goto("/app/proprietes/import");
  // Un ZIP trop lourd (photos comprises) est arrêté par le navigateur, avec un message clair.
  const big = Buffer.from(zipSync({ "Annonces.csv": strToU8(csv), "photo.jpg": new Uint8Array(3_000_000).map((_, i) => (i * 2654435761) >>> 24) }, { level: 0 }));
  await page.getByLabel("Fichier CSV").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: big });
  expect(await page.getByLabel("Fichier CSV").evaluate((el) => (el as HTMLInputElement).validationMessage))
    .toBe("Fichier ZIP trop volumineux (2,8 Mo au maximum) : envoyez seulement le fichier Annonces.csv qu'il contient.");
  await page.getByLabel("Fichier CSV").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: zip });
  expect(await page.getByLabel("Fichier CSV").evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe("");
  await page.getByRole("button", { name: "Vérifier le fichier" }).click();
  await expect(page.getByText("1 à importer")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Annonce LO7 : « Location » n'est pas une vente/)).toBeVisible();
  await page.getByRole("button", { name: "Importer 1 biens" }).click();
  await expect(page.getByText("1 bien(s) importé(s).")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Voir les biens" }).click();
  await page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await expect(page.getByText(/référence VE42/)).toBeVisible();
  await page.getByRole("link", { name: "Annonce", exact: true }).click();
  await expect(page.getByTestId("listing-text")).toContainText("T3 lumineux près de la gare");
  await expect(page.getByTestId("listing-text")).toContainText("Bel appartement.");
});
