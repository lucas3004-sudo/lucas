/**
 * CRM et matching de bout en bout (critères F5 et F6) :
 * deux négociateurs ; l'un a un acquéreur PRIVÉ, l'autre un bien en mandat.
 * Le rapprochement se fait à l'échelle de l'agence, sans révéler l'identité de l'acquéreur ;
 * « Prévenir » crée une tâche pour son responsable. Adresses e-mail en .invalid, jamais réelles.
 */
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const password = "motdepasse-de-test-1234";
const gerant = { name: "Gaëlle Gérante", email: `crm-gerant-${run}@test.invalid` };
const hugo = { name: "Hugo Vendeur", email: `crm-hugo-${run}@test.invalid` };
const ines = { name: "Inès Acquéreurs", email: `crm-ines-${run}@test.invalid` };
const buyerEmail = `paul-${run}@test.invalid`;
const address = "8 Boulevard du Port 80000 Amiens";

/** E2E_CAPTURES=<dossier> : enregistre des captures d'écran pour la documentation. */
async function capture(page: Page, name: string) {
  if (!process.env.E2E_CAPTURES) return;
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.screenshot({ path: `${process.env.E2E_CAPTURES}/${name}.png`, fullPage: true });
}

async function signUp(page: Page, user: { name: string; email: string }) {
  await page.getByLabel("Nom et prénom").fill(user.name);
  await page.getByLabel("Adresse e-mail professionnelle").fill(user.email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe.serial("CRM et matching", () => {
  const links: string[] = [];
  let contactUrl = "";
  let propertyUrl = "";

  test("le gérant crée l'agence et invite deux négociateurs", async ({ page }) => {
    await page.goto("/inscription");
    await signUp(page, gerant);
    await page.getByLabel("Nom de l'agence").fill(`Agence CRM ${run}`);
    await page.getByRole("button", { name: "Créer l'agence" }).click();
    await expect(page.getByRole("heading", { name: "Bonjour Gaëlle" })).toBeVisible();
    for (const user of [hugo, ines]) {
      await page.goto("/app/equipe");
      await page.getByLabel("Adresse e-mail").fill(user.email);
      await page.getByLabel("Rôle").selectOption("negociateur");
      await page.getByRole("button", { name: "Créer l'invitation" }).click();
      const link = page.getByLabel("Lien d'invitation", { exact: true });
      await expect(link).toBeVisible();
      links.push(new URL(await link.inputValue()).pathname);
    }
  });

  test("les deux négociateurs rejoignent l'agence", async ({ page }) => {
    for (const [i, user] of [hugo, ines].entries()) {
      await page.context().clearCookies();
      await page.goto(links[i]!);
      await page.getByRole("link", { name: "Créer un compte" }).click();
      await signUp(page, user);
      await page.getByRole("button", { name: "Accepter l'invitation" }).click();
      await expect(page.getByRole("heading", { name: `Bonjour ${user.name.split(" ")[0]}` })).toBeVisible();
    }
  });

  test("Inès crée un acquéreur privé, son consentement et son profil de recherche", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, ines.email);
    await page.getByRole("link", { name: "Contacts" }).first().click();
    await page.getByRole("link", { name: "Nouveau contact" }).click();
    await page.getByLabel("Prénom").fill("Paul");
    await page.getByLabel("Nom", { exact: true }).fill("Acheteur");
    await page.getByLabel("E-mail").fill(buyerEmail);
    await page.getByLabel("Téléphone").fill("+33 6 12 34 56 78");
    await page.getByLabel("Acquéreur").check();
    await page.getByLabel("Visibilité").selectOption("private");
    await page.getByRole("button", { name: "Créer le contact" }).click();
    await expect(page.getByRole("heading", { name: "Paul Acheteur" })).toBeVisible();
    contactUrl = new URL(page.url()).pathname;

    await page.getByText("Enregistrer un consentement ou un retrait").click();
    await page.getByLabel("Canal").selectOption("email");
    await page.getByLabel("Preuve").fill("Accord écrit sur la fiche de visite signée à l'agence.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Consentement enregistré.")).toBeVisible();
    await expect(page.locator("span").getByText("Accordé", { exact: true })).toBeVisible();

    await page.getByText("Ajouter un profil de recherche").click();
    await page.getByLabel("Budget maximal (€)").fill("300000");
    await page.getByLabel("Surface minimale (m²)").fill("50");
    await page.getByLabel("Pièces minimum").fill("3");
    await page.getByLabel("Codes postaux recherchés").fill("80000");
    await page.getByRole("button", { name: "Ajouter le profil" }).click();
    await expect(page.getByText("Profil de recherche enregistré.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Appartement · jusqu.à 300\s000\s€/)).toBeVisible();
  });

  test("un doublon est signalé avant création, sans perdre la saisie", async ({ page }) => {
    await signIn(page, ines.email);
    await page.goto("/app/contacts/nouveau");
    await page.getByLabel("Nom", { exact: true }).fill("Acheteur");
    await page.getByLabel("E-mail").fill(buyerEmail.toUpperCase());
    await page.getByRole("button", { name: "Créer le contact" }).click();
    await expect(page.getByText("Ce contact ressemble à un contact existant.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Paul Acheteur" })).toBeVisible();
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Acheteur");
  });

  test("Hugo crée un bien : l'acquéreur privé d'Inès correspond, anonymement", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, hugo.email);

    // Le tableau de bord de l'agence est réservé au gérant et aux managers.
    await expect(page.getByRole("link", { name: "Pilotage" })).toHaveCount(0);
    await page.goto("/app/pilotage");
    await expect(page.getByText("réservé au gérant et aux managers")).toBeVisible();

    // Le contact privé d'Inès est invisible pour Hugo, y compris par son adresse directe.
    await page.goto("/app/contacts");
    await expect(page.getByText("Paul Acheteur")).toHaveCount(0);
    await page.goto(contactUrl);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

    await page.goto("/app/proprietes/nouveau");
    await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
    await page.getByRole("option", { name: new RegExp(address) }).click();
    await page.getByLabel("Surface habitable (m²)").fill("62");
    await page.getByLabel("Pièces principales").fill("3");
    await page.getByLabel("Prix affiché (€)").fill("250000");
    await page.getByRole("button", { name: "Créer le bien" }).click();
    await expect(page.getByRole("heading", { name: address })).toBeVisible({ timeout: 20_000 });
    propertyUrl = new URL(page.url()).pathname;

    const match = page.getByRole("listitem").filter({ hasText: `Acquéreur de ${ines.name} (privé)` });
    await expect(match).toBeVisible();
    await expect(match.getByText("100 %")).toBeVisible();
    await expect(page.getByText("Paul")).toHaveCount(0);

    // Pondérations ajustables : le score reste expliqué.
    await page.getByText("Pondérations").click();
    await page.getByLabel("Budget").fill("0");
    await page.getByRole("button", { name: "Recalculer" }).click();
    await expect(page.getByText("Pondérations (personnalisées)")).toBeVisible();

    await match.getByRole("button", { name: `Prévenir ${ines.name}` }).click();
    await expect(match.getByText(`${ines.name} prévenu(e)`)).toBeVisible();
    await match.getByText("Pourquoi ce score ?").click();
    await capture(page, "09-bien-acquereurs-correspondants");

    // Le bien alimente l'Investment Studio : adresse et prix repris comme hypothèses.
    await page.getByRole("link", { name: "Simuler un investissement" }).click();
    await expect(page.getByText(`Simulation locative pour ${address}.`)).toBeVisible();
    await expect(page.getByLabel(/Prix d'achat/)).toHaveValue("250000");
  });

  test("Inès reçoit la tâche et voit le bien correspondant sur la fiche de son acquéreur", async ({ page }) => {
    await signIn(page, ines.email);
    await page.getByRole("link", { name: "Tâches" }).first().click();
    await expect(page.getByText("Bien correspondant à l'un de vos acquéreurs (100 %)")).toBeVisible();
    await expect(page.getByText(new RegExp(`${hugo.name} signale que le bien « ${address} »`))).toBeVisible();
    await page.getByRole("button", { name: "Marquer faite" }).click();
    await expect(page.getByRole("button", { name: "Rouvrir" })).toBeVisible();

    await capture(page, "10-taches");
    await page.goto(contactUrl);
    await expect(page.getByRole("link", { name: address })).toBeVisible();
    await capture(page, "11-fiche-contact");
  });

  test("le gérant voit l'acquéreur privé, et les actions sont journalisées sans données personnelles", async ({ page }) => {
    await signIn(page, gerant.email);
    await page.goto("/app/contacts");
    await expect(page.getByRole("link", { name: /Paul Acheteur/ })).toBeVisible();
    await page.goto(propertyUrl);
    await expect(page.getByRole("link", { name: "Paul Acheteur" })).toBeVisible();

    await page.goto("/app/journal");
    for (const label of ["Contact créé", "Consentement enregistré", "Profil de recherche créé", "Bien de l'agence créé", "Tâche créée"]) {
      await expect(page.getByRole("cell", { name: label, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(buyerEmail)).toHaveCount(0);
    await expect(page.getByText("Acheteur")).toHaveCount(0);
  });

  test("le gérant pilote l'agence : activité mesurée par membre, biens couverts, relances en retard", async ({ page }) => {
    await signIn(page, gerant.email);
    // Une relance en retard confiée à Hugo (échéance : hier).
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.goto("/app/taches");
    await page.getByLabel("Tâche", { exact: true }).fill("Rappeler le vendeur");
    await page.getByLabel("Pour", { exact: true }).selectOption({ label: hugo.name });
    await page.getByLabel("Échéance").fill(yesterday);
    await page.getByRole("button", { name: "Ajouter la tâche" }).click();
    await expect(page.getByText("Tâche créée.")).toBeVisible();

    await page.getByRole("link", { name: "Pilotage" }).click();
    await expect(page.getByRole("heading", { name: "Pilotage de l'agence" })).toBeVisible();
    await expect(page.getByText(/Période du .* au /)).toBeVisible();
    // Colonnes : contacts, consentements, biens, dossiers, tâches créées, tâches terminées, en retard.
    const cells = (name: string) => page.getByRole("row", { name: new RegExp(name) }).getByRole("cell");
    await expect(cells(ines.name).nth(0)).toHaveText("1");
    await expect(cells(ines.name).nth(1)).toHaveText("1");
    await expect(cells(ines.name).nth(5)).toHaveText("1");
    await expect(cells(hugo.name).nth(2)).toHaveText("1");
    await expect(cells(hugo.name).nth(4)).toHaveText("1");
    await expect(cells(hugo.name).nth(6)).toHaveText("1");
    await expect(cells(gerant.name).nth(4)).toHaveText("1");
    await expect(page.getByText("Chaque bien proposé a au moins un acquéreur correspondant.")).toBeVisible();
    await expect(page.getByText("Relances en retard (1)")).toBeVisible();
    await expect(page.getByText("Rappeler le vendeur")).toBeVisible();
    await capture(page, "13-pilotage");
  });
});
