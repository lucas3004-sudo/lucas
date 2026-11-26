/**
 * Prospection (D-072) : un négociateur ajoute un bien repéré (annonce de particulier) et le suit
 * jusqu'au mandat dans le CRM existant : lien de l'annonce, propriétaire, accords de contact,
 * favori, relance datée (tâche, jamais en double), mandat obtenu, historique et journal.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const ADDRESS = "12 Rue des Jacobins 80000 Amiens";

function parisDay(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}
const frDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(`${iso}T12:00:00Z`));

async function noSeriousViolation(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("un négociateur suit un bien repéré, de l'annonce du particulier jusqu'au mandat", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Paul Prospection");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`prospection-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Prospection ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Paul" })).toBeVisible();

  // Liste vide : elle explique quoi faire, et rappelle la règle du démarchage.
  await page.getByRole("link", { name: "Prospection" }).first().click();
  await expect(page.getByText("Aucun bien en prospection pour le moment.")).toBeVisible();
  await expect(page.getByText(/seulement avec l'accord préalable du propriétaire/)).toBeVisible();

  // Un bien repéré sur une annonce de particulier ; un lien non https est refusé.
  await page.getByRole("link", { name: "Ajouter un bien repéré" }).click();
  await expect(page.getByRole("heading", { name: "Ajouter un bien repéré" })).toBeVisible();
  await expect(page.getByLabel("Statut", { exact: true })).toHaveCount(0);
  await page.getByLabel("Adresse du bien").fill("12 rue des jacobins amiens");
  await page.getByRole("option", { name: new RegExp(ADDRESS) }).click();
  await page.getByLabel("Surface habitable (m²)").fill("85");
  await page.getByLabel("Pièces principales").fill("4");
  await page.getByLabel("Prix affiché (€)").fill("210000");
  await page.getByLabel("Lien de l'annonce (facultatif)").fill("http://www.exemple.fr/annonce/42");
  await page.getByRole("button", { name: "Ajouter à ma prospection" }).click();
  await expect(page.getByText("Le lien de l'annonce doit commencer par https:// (500 caractères au plus).")).toBeVisible();
  await page.getByLabel("Lien de l'annonce (facultatif)").fill("https://www.exemple.fr/annonce/42");
  await page.getByRole("button", { name: "Ajouter à ma prospection" }).click();
  await expect(page.getByText("Bien ajouté à votre prospection, « à contacter ».")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Voir l'annonce d'origine ↗" })).toHaveAttribute("href", "https://www.exemple.fr/annonce/42");
  await expect(page.locator("span").getByText("Prospect", { exact: true })).toBeVisible();
  await expect(page.getByText("Propriétaire non renseigné.")).toBeVisible();
  const propertyPath = new URL(page.url()).pathname;

  // Le propriétaire devient un contact (vendeur) ; son numéro ne suffit pas pour l'appeler.
  await page.goto("/app/contacts/nouveau");
  await page.getByLabel("Prénom").fill("Jeanne");
  await page.getByLabel("Nom", { exact: true }).fill(`Proprio ${run}`);
  await page.getByLabel("Téléphone").fill("06 22 33 44 55");
  await page.getByLabel("Vendeur").check();
  await page.getByRole("button", { name: "Créer le contact" }).click();
  await expect(page.getByRole("heading", { name: `Jeanne Proprio ${run}` })).toBeVisible();
  const contactPath = new URL(page.url()).pathname;
  await page.goto(propertyPath);
  await page.getByLabel("Propriétaire (contact vendeur)").selectOption({ label: `Jeanne Proprio ${run}` });
  await page.getByRole("button", { name: "Enregistrer le propriétaire" }).click();
  await expect(page.getByRole("link", { name: `Jeanne Proprio ${run}` })).toBeVisible();
  await expect(page.getByText(/Aucun accord enregistré : ni appel ni e-mail de prospection/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Appeler" })).toHaveCount(0);

  // Elle donne son accord par téléphone (preuve notée sur sa fiche) : l'appel devient possible.
  await page.goto(contactPath);
  await page.getByText("Enregistrer un consentement ou un retrait").click();
  await page.getByLabel("Canal").selectOption({ label: "Téléphone" });
  await page.getByLabel("Preuve").fill("Accord oral lors de la visite d'estimation du 26/11.");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Consentement enregistré.")).toBeVisible();

  await page.goto("/app/prospection");
  const item = page.getByRole("listitem", { name: ADDRESS });
  await expect(item.locator("span").getByText("À contacter", { exact: true })).toBeVisible();
  await expect(item.getByText("85 m² · 4 pièce(s)", { exact: false })).toBeVisible();
  await expect(item.getByText("Accord enregistré : vous pouvez le contacter par téléphone.")).toBeVisible();
  await expect(item.getByRole("link", { name: "Appeler" })).toHaveAttribute("href", "tel:0622334455");
  await expect(item.getByRole("link", { name: "Écrire un e-mail" })).toHaveCount(0);
  await expect(item.getByRole("link", { name: `Voir l'annonce d'origine : ${ADDRESS}` })).toHaveAttribute("href", "https://www.exemple.fr/annonce/42");
  await expect(item.getByRole("link", { name: `Analyse du prix : ${ADDRESS}` })).toHaveAttribute("href", `${propertyPath}/fiche`);

  // Favori, puis relance datée : une tâche pour le responsable, décalée (jamais doublée) si on relance encore.
  await item.getByRole("button", { name: `Mettre en favori : ${ADDRESS}` }).click();
  await expect(item.getByText("★ Favori")).toBeVisible();
  await item.getByLabel(`Statut de prospection : ${ADDRESS}`).selectOption({ label: "Relance à effectuer" });
  await item.getByLabel(`Date de relance : ${ADDRESS}`).fill(parisDay(3));
  await item.getByRole("button", { name: `Mettre à jour le statut : ${ADDRESS}` }).click();
  await expect(item.locator("span").getByText("Relance à effectuer", { exact: true })).toBeVisible();
  await expect(item.getByText(`Prochaine tâche : ${frDay(parisDay(3))}`)).toBeVisible();
  await item.getByLabel(`Date de relance : ${ADDRESS}`).fill(parisDay(5));
  await item.getByRole("button", { name: `Mettre à jour le statut : ${ADDRESS}` }).click();
  await expect(item.getByText(`Prochaine tâche : ${frDay(parisDay(5))}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Relance à effectuer (1)" })).toBeVisible();
  await noSeriousViolation(page);
  await page.goto("/app/taches");
  await expect(page.getByText(`Relancer le propriétaire : ${ADDRESS}`)).toHaveCount(1);

  // Rendez-vous puis mandat obtenu : le bien passe « sous mandat » et quitte la liste « en cours ».
  await page.goto("/app/prospection");
  await item.getByLabel(`Statut de prospection : ${ADDRESS}`).selectOption({ label: "Rendez-vous obtenu" });
  await item.getByRole("button", { name: `Mettre à jour le statut : ${ADDRESS}` }).click();
  await expect(item.locator("span").getByText("Rendez-vous obtenu", { exact: true })).toBeVisible();
  await item.getByLabel(`Statut de prospection : ${ADDRESS}`).selectOption({ label: "Mandat obtenu" });
  await item.getByRole("button", { name: `Mettre à jour le statut : ${ADDRESS}` }).click();
  await expect(page.getByRole("listitem", { name: ADDRESS })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mandat obtenu (1)" })).toBeVisible();
  await page.getByRole("link", { name: "Mandat obtenu (1)" }).click();
  await expect(page.getByRole("listitem", { name: ADDRESS })).toBeVisible();

  await page.goto(propertyPath);
  await expect(page.getByText("Sous mandat", { exact: true }).first()).toBeVisible();
  await page.goto(`${propertyPath}/fiche`);
  const timeline = page.getByRole("list", { name: "Chronologie du bien" });
  await expect(timeline.getByText("Ajouté à la prospection (À contacter)")).toBeVisible();
  await expect(timeline.getByText("Prospection : Rendez-vous obtenu → Mandat obtenu")).toBeVisible();
  await expect(timeline.getByText("Statut : Prospect → Sous mandat")).toBeVisible();

  // Un bien déjà saisi (prospect) peut aussi être suivi en prospection.
  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByLabel("Statut").selectOption({ label: "Prospect" });
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: "8 Boulevard du Port 80000 Amiens" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Suivre en prospection" }).click();
  await expect(page.getByRole("heading", { name: "Prospection" })).toBeVisible();
  await page.goto("/app/prospection");
  await expect(page.getByRole("listitem", { name: "8 Boulevard du Port 80000 Amiens" }).locator("span").getByText("À contacter", { exact: true })).toBeVisible();

  // Journal : les changements sont tracés, sans donnée personnelle.
  await page.goto("/app/journal");
  await expect(page.getByRole("cell", { name: "Statut de prospection d'un bien modifié", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Propriétaire d'un bien renseigné", exact: true }).first()).toBeVisible();
});
