/**
 * Compte rendu de visite (F9, sans IA) : une visite passée apparaît « sans compte rendu » ;
 * le compte rendu produit un texte pour le vendeur, sans l'identité des visiteurs ; la fiche du
 * bien en fait la synthèse.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const address = "8 Boulevard du Port 80000 Amiens";
// Il y a deux jours, 10 h à Paris (champ datetime-local).
const twoDaysAgo = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() - 2 * 86_400_000));

test("un négociateur rédige le compte rendu d'une visite passée et obtient le texte pour le vendeur", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Vera Visite");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`visite-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Visite ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Vera" })).toBeVisible();

  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Surface habitable (m²)").fill("62");
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
  const propertyPath = new URL(page.url()).pathname;

  // Le visiteur, enregistré comme contact.
  await page.goto("/app/contacts/nouveau");
  await page.getByLabel("Prénom").fill("Paul");
  await page.getByLabel("Nom", { exact: true }).fill(`Visiteur ${run}`);
  await page.getByLabel("Acquéreur").check();
  await page.getByRole("button", { name: "Créer le contact" }).click();
  await expect(page.getByRole("heading", { name: `Paul Visiteur ${run}` })).toBeVisible();
  const contactPath = new URL(page.url()).pathname;

  // Visite d'il y a deux jours.
  await page.goto("/app/agenda");
  await page.getByLabel("Objet").fill("Visite famille Martin");
  await page.getByLabel("Début (heure de Paris)").fill(`${twoDaysAgo}T10:00`);
  await page.getByLabel("Bien", { exact: true }).selectOption({ label: address });
  await page.getByLabel("Contact", { exact: true }).selectOption({ label: `Paul Visiteur ${run}` });
  await page.getByRole("button", { name: "Planifier" }).click();
  await expect(page.getByText("Rendez-vous enregistré.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visites sans compte rendu (1)" })).toBeVisible();

  await page.getByRole("link", { name: /Visite famille Martin/ }).click();
  await expect(page.getByRole("heading", { name: "Compte rendu de visite" })).toBeVisible();
  await expect(page.getByText("Le texte apparaîtra ici une fois le compte rendu enregistré.")).toBeVisible();
  await page.getByLabel("Intérêt fort").check();
  await page.getByLabel("Prix jugé un peu élevé").check();
  await page.getByLabel("Envisage de faire une offre").check();
  await page.getByLabel("Points appréciés").fill("luminosité, balcon");
  await page.getByLabel("Réserves exprimées").fill("cuisine à refaire");
  await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
  await expect(page.getByText("Compte rendu enregistré.")).toBeVisible();

  const text = page.getByTestId("seller-text");
  await expect(text).toContainText("Les visiteurs se sont montrés très intéressés par votre bien.");
  await expect(text).toContainText("Points appréciés : luminosité, balcon.");
  await expect(text).toContainText("Réserves exprimées : cuisine à refaire.");
  await expect(text).toContainText("Ils trouvent le prix un peu élevé.");
  await expect(text).toContainText(`(${address})`);
  await expect(text).toContainText("Vera Visite");
  await expect(text).not.toContainText("Martin"); // l'objet du rendez-vous (nom des visiteurs) n'y figure pas
  await expect(text).not.toContainText("Visiteur"); // ni le contact lié
  await expect(page.getByRole("button", { name: "Copier le texte" })).toBeVisible();

  // Mise à jour : le même compte rendu, pas un second.
  await page.getByLabel("Intérêt moyen").check();
  await page.getByRole("button", { name: "Mettre à jour le compte rendu" }).click();
  await expect(text).toContainText("intéressés par votre bien, avec quelques réserves.");

  await page.goto("/app/agenda");
  await expect(page.getByRole("heading", { name: /Visites sans compte rendu/ })).toHaveCount(0);

  await page.goto(propertyPath);
  await expect(page.getByRole("heading", { name: "Comptes rendus de visite (1)" })).toBeVisible();
  await expect(page.getByText("0 intérêt fort, 1 offre(s) envisagée(s), réserve sur le prix 1 fois sur 1.")).toBeVisible();

  // Droit d'accès (RGPD) du visiteur : le compte rendu de sa visite est inclus.
  const exported = await (await page.request.get(`/api/v1${contactPath.replace("/app", "")}/export`)).json();
  expect(exported.rendez_vous[0].compte_rendu).toMatchObject({ interet: "Intérêt moyen", suite: "Envisage de faire une offre", reserves: "cuisine à refaire" });

  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Compte rendu de visite enregistré", exact: true }).first()).toBeVisible();
});
