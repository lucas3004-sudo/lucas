/**
 * Page publique « Estimez votre bien » (D-067) : l'agence ouvre sa page, un propriétaire (sans
 * compte) obtient une fourchette et demande à être rappelé avec son accord ; la demande arrive
 * dans le CRM (contact vendeur, consentement, bien à prospecter, tâche).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const expectDvf = process.env.E2E_EXPECT_DVF === "1";

test("une agence ouvre sa page d'estimation et reçoit la demande d'un propriétaire", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Nora Estimation");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`estimation-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Estimation ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Nora" })).toBeVisible();

  await page.goto("/app/parametres");
  await expect(page.getByText("La page est fermée : personne ne peut l'ouvrir.")).toBeVisible();
  await page.getByLabel("Ouvrir la page au public").check();
  await page.getByLabel("Qui reçoit les demandes ?").selectOption({ label: "Nora Estimation" });
  await page.getByRole("button", { name: "Mettre à jour la page" }).click();
  await expect(page.getByText("Page « Estimez votre bien » enregistrée.")).toBeVisible();
  const link = await page.getByLabel("Lien de votre page").inputValue();
  expect(link).toMatch(/\/estimer\/[a-z0-9-]+$/);
  const publicPath = new URL(link).pathname;

  // Le propriétaire, sans compte. Adresse IP propre à ce test (les envois sont limités par connexion).
  const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250) + 1}` } });
  const owner = await visitor.newPage();
  await owner.goto(publicPath);
  await expect(owner.getByRole("heading", { name: /Estimez votre bien/ })).toBeVisible();
  await expect(owner.getByText(`Agence Estimation ${run}`).first()).toBeVisible();
  // Adresse imprécise : refusée avec une explication.
  await owner.getByLabel("Adresse du bien").fill("Amiens");
  await owner.getByLabel("Surface (m²)").fill("60");
  await owner.getByRole("button", { name: "Voir l'estimation" }).click();
  await expect(owner.getByText("Adresse introuvable : indiquez le numéro, la rue et la ville.")).toBeVisible();
  await owner.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
  await owner.getByLabel("Surface (m²)").fill("60");
  await owner.getByLabel("Pièces").fill("3");
  await owner.getByRole("button", { name: "Voir l'estimation" }).click();
  await expect(owner.getByText("8 Boulevard du Port 80000 Amiens")).toBeVisible({ timeout: 20_000 });
  if (expectDvf) await expect(owner.getByTestId("fourchette")).toHaveText(/^Entre [\d\s ]+ € et [\d\s ]+ €$/);
  else await expect(owner.getByTestId("fourchette")).toContainText("trop peu de ventes comparables");
  const a11y = await new AxeBuilder({ page: owner }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Sans accord coché : refusé. Puis accord par e-mail : envoyé.
  await owner.waitForTimeout(3100);
  await owner.getByLabel("Prénom").fill("Lucie");
  await owner.getByLabel("Nom", { exact: true }).fill(`Vendeuse ${run}`);
  await owner.getByLabel("E-mail", { exact: true }).fill(`lucie-${run}@test.invalid`);
  await owner.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(owner.getByText("Cochez la case qui correspond à votre e-mail ou à votre téléphone pour accepter d'être recontacté.")).toBeVisible();
  await owner.getByLabel("Prénom").fill("Lucie");
  await owner.getByLabel("Nom", { exact: true }).fill(`Vendeuse ${run}`);
  await owner.getByLabel("E-mail", { exact: true }).fill(`lucie-${run}@test.invalid`);
  await owner.getByLabel(/me contacte par e-mail/).check();
  await owner.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(owner.getByText("Merci, votre demande est envoyée.")).toBeVisible();
  await visitor.close();

  // Côté agence : la demande est dans le CRM.
  await page.goto("/app/taches");
  await expect(page.getByText(`Rappeler Lucie Vendeuse ${run} : demande d'estimation en ligne`)).toBeVisible();
  await page.goto("/app/contacts");
  await page.getByRole("link", { name: new RegExp(`Lucie Vendeuse ${run}`) }).click();
  await expect(page.getByText("Estimation en ligne").first()).toBeVisible();
  await expect(page.locator("span").getByText("Accordé", { exact: true })).toBeVisible();
  await page.goto("/app/proprietes");
  await expect(page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ })).toBeVisible();
  // Prospection (D-072) : la demande y arrive « à contacter » ; l'e-mail est possible (accord), pas l'appel.
  await page.goto("/app/prospection");
  const lead = page.getByRole("listitem", { name: "8 Boulevard du Port 80000 Amiens" });
  await expect(lead.locator("span").getByText("À contacter", { exact: true })).toBeVisible();
  await expect(lead.getByText("Accord enregistré : vous pouvez le contacter par e-mail.")).toBeVisible();
  await expect(lead.getByRole("link", { name: "Écrire un e-mail" })).toHaveAttribute("href", `mailto:lucie-${run}@test.invalid`);
  await expect(lead.getByRole("link", { name: "Appeler" })).toHaveCount(0);

  // Page refermée : introuvable pour le public.
  await page.goto("/app/parametres");
  await page.getByLabel("Ouvrir la page au public").uncheck();
  await page.getByRole("button", { name: "Mettre à jour la page" }).click();
  await expect(page.getByText("La page est fermée : personne ne peut l'ouvrir.")).toBeVisible();
  const closed = await page.request.get(publicPath);
  expect(closed.status()).toBe(404);
});
