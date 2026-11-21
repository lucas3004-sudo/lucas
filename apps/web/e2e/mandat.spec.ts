/**
 * Suivi des mandats (F5, migration 0019) : numéro, dates, rappel 30 jours avant la fin
 * (« Ma journée »), mandat expiré signalé dans « Qualité des données », numéro unique dans l'agence.
 */
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const parisDay = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + offsetDays * 86_400_000));

async function createProperty(page: Page, query: string, label: string) {
  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill(query);
  await page.getByRole("option", { name: new RegExp(label) }).click();
  await page.getByLabel("Surface habitable (m²)").fill("70");
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: label })).toBeVisible({ timeout: 20_000 });
  return new URL(page.url()).pathname;
}

async function saveMandate(page: Page, values: { number?: string; type?: string; signedOn?: string; endsOn?: string }) {
  await page.getByText("Modifier le mandat").click();
  if (values.type) await page.getByLabel("Type de mandat").selectOption(values.type);
  if (values.number !== undefined) await page.getByLabel("Numéro de mandat").fill(values.number);
  if (values.signedOn) await page.getByLabel("Signé le").fill(values.signedOn);
  if (values.endsOn) await page.getByLabel("Fin du mandat").fill(values.endsOn);
  await page.getByRole("button", { name: "Enregistrer le mandat" }).click();
}

test("un négociateur suit ses mandats : rappel avant la fin, mandat expiré signalé, numéro unique", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Marc Mandat");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`mandat-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Mandat ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Marc" })).toBeVisible();

  // Mandat exclusif qui se termine dans 10 jours.
  const first = await createProperty(page, "8 boulevard du port amiens", "8 Boulevard du Port 80000 Amiens");
  await saveMandate(page, { type: "exclusif", number: "M-2026-042", signedOn: parisDay(-80), endsOn: parisDay(10) });
  await expect(page.getByText("Mandat enregistré.")).toBeVisible();
  await expect(page.getByText("Mandat : fin dans 10 jour(s)")).toBeVisible();
  await expect(page.getByText("M-2026-042")).toBeVisible();

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Mandats à renouveler (1)" })).toBeVisible();
  await expect(page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens.*Mandat : fin dans 10 jour\(s\)/ })).toBeVisible();

  // Fin avant la signature : refusé avec un message clair.
  await page.goto(first);
  await saveMandate(page, { signedOn: parisDay(-10), endsOn: parisDay(-20) });
  await expect(page.getByText("La date de fin doit suivre la date de signature.")).toBeVisible();

  // Même numéro sur un autre bien de l'agence : refusé.
  await createProperty(page, "2 place gambetta amiens", "2 Place Gambetta 80000 Amiens");
  await saveMandate(page, { number: "M-2026-042" });
  await expect(page.getByText("Ce numéro de mandat est déjà utilisé dans l'agence.")).toBeVisible();

  // Mandat expiré depuis 2 jours : signalé dans la qualité des données.
  await page.goto(first);
  await saveMandate(page, { signedOn: parisDay(-90), endsOn: parisDay(-2) });
  await expect(page.getByText("Mandat enregistré.")).toBeVisible();
  await expect(page.getByText("Mandat expiré depuis 2 jour(s)")).toBeVisible();
  await page.goto("/app/qualite");
  const expired = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mandats expirés" }) });
  await expect(expired.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens.*Mandat expiré depuis 2 jour\(s\)/ })).toBeVisible();

  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Mandat d'un bien modifié", exact: true }).first()).toBeVisible();
});
