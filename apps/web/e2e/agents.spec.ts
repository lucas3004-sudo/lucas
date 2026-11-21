/**
 * Agent Center de bout en bout : agents déterministes (sans IA), mission journalisée, fusion de
 * doublons proposée par un agent puis APPROUVÉE par le gérant (L2), activation par le gérant.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);
const dupEmail = `jean-${run}@test.invalid`;

test("le gérant fait travailler les agents et approuve une fusion de doublons", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Gina Agents");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`agents-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Agents ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Gina" })).toBeVisible();

  // Deux fiches pour la même personne : la seconde est créée malgré l'avertissement.
  for (const [first, phone, confirm] of [["Jean", "06 11 22 33 44", false], ["J.", "", true]] as const) {
    await page.goto("/app/contacts/nouveau");
    await page.getByLabel("Prénom").fill(first);
    await page.getByLabel("Nom", { exact: true }).fill("Doublon");
    await page.getByLabel("E-mail").fill(dupEmail);
    if (phone) await page.getByLabel("Téléphone").fill(phone);
    await page.getByLabel("Acquéreur").check();
    await page.getByRole("button", { name: "Créer le contact" }).click();
    if (confirm) {
      await page.getByLabel("C'est bien une autre personne : créer quand même").check();
      await page.getByRole("button", { name: "Créer le contact" }).click();
    }
    await expect(page.getByRole("heading", { name: `${first} Doublon` })).toBeVisible();
  }
  // Sur le doublon : un consentement et une tâche, qui devront être repris par la fusion.
  await page.getByText("Enregistrer un consentement ou un retrait").click();
  await page.getByLabel("Preuve").fill("Accord écrit lors du salon de l'habitat.");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Consentement enregistré.")).toBeVisible();
  await page.getByText("Ajouter une tâche").click();
  await page.getByLabel("Tâche", { exact: true }).fill("Rappeler Jean pour la visite");
  await page.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByText("Tâche créée.")).toBeVisible();

  // Agent « Détection des doublons » : il propose, il ne fusionne pas.
  await page.getByRole("link", { name: "Agents" }).first().click();
  await expect(page.getByText("0 € (aucun appel à un modèle)").first()).toBeVisible();
  await page.getByRole("button", { name: "Lancer Détection des doublons" }).click();
  await expect(page.getByText("1 groupe(s) de doublons, 1 fusion(s) proposée(s) à l'approbation.").first()).toBeVisible();
  await expect(page.getByText("1 approbation(s) en attente")).toBeVisible();
  await page.goto("/app/contacts");
  await expect(page.getByRole("link", { name: /Doublon/ })).toHaveCount(2);

  // Approbation par le gérant : la fusion a lieu.
  await page.goto("/app/agents/approbations");
  const request = page.getByRole("listitem").filter({ hasText: "Fusionner deux contacts en double (même e-mail)" });
  await expect(request.getByRole("link", { name: "Jean Doublon" })).toBeVisible();
  await expect(request.getByRole("link", { name: "J. Doublon" })).toBeVisible();
  await request.getByRole("button", { name: "Approuver" }).click();
  await expect(request.getByText("Approuvée")).toBeVisible();

  await page.goto("/app/contacts");
  await expect(page.getByRole("link", { name: /Doublon/ })).toHaveCount(1);
  await page.getByRole("link", { name: /Jean Doublon/ }).click();
  await expect(page.locator("span").getByText("Accordé", { exact: true })).toBeVisible();
  await expect(page.getByText("Rappeler Jean pour la visite")).toBeVisible();

  // Autres agents : missions réussies, journalisées.
  await page.goto("/app/agents");
  for (const name of ["Qualité des données", "Veille des échéances", "Opportunity Finder"]) {
    await page.getByRole("button", { name: `Lancer ${name}` }).click();
    await expect(page.getByRole("row").filter({ hasText: name }).first().getByText("Réussie")).toBeVisible();
  }
  await expect(page.getByText(/point\(s\) à reprendre\./).first()).toBeVisible();

  // Le gérant désactive un agent : il ne peut plus être lancé.
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Veille des échéances" }) });
  await card.getByRole("button", { name: "Désactiver" }).click();
  await expect(card.getByText("Désactivé", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /^Lancer/ })).toHaveCount(0);
  await card.getByRole("button", { name: "Activer" }).click();
  await expect(card.getByRole("button", { name: "Lancer Veille des échéances" })).toBeVisible();

  await page.goto("/app/journal");
  for (const label of ["Mission d'agent lancée", "Demande d'approbation décidée", "Agent activé ou désactivé"]) {
    await expect(page.getByRole("cell", { name: label, exact: true }).first()).toBeVisible();
  }
});
