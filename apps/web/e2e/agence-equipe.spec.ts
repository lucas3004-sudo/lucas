/**
 * Parcours de bout en bout de la phase 3 (critères d'acceptation F1) :
 * inscription → création d'agence → invitation → acceptation → droits par rôle → journal d'audit.
 * Chaque exécution crée des comptes uniques (adresses en .invalid, jamais réelles).
 */
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const password = "motdepasse-de-test-1234";
const gerant = { name: "Claire Gérante", email: `gerant-${run}@test.invalid` };
const nego = { name: "Hugo Négociateur", email: `nego-${run}@test.invalid` };
const agency = `Agence Test ${run}`;

async function signUp(page: Page, user: { name: string; email: string }) {
  await page.getByLabel("Nom et prénom").fill(user.name);
  await page.getByLabel("Adresse e-mail professionnelle").fill(user.email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

test.describe.serial("agence et équipe", () => {
  let invitationLink = "";

  test("un gérant crée son compte et son agence", async ({ page }) => {
    await page.goto("/inscription");
    await signUp(page, gerant);
    await expect(page.getByRole("heading", { name: "Créer l'espace de votre agence" })).toBeVisible();
    await page.getByLabel("Nom de l'agence").fill(agency);
    await page.getByRole("button", { name: "Créer l'agence" }).click();
    await expect(page.getByRole("heading", { name: "Bonjour Claire" })).toBeVisible();
    await expect(page.getByText(agency).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Journal d'audit" })).toBeVisible();
  });

  test("le gérant invite un négociateur et obtient un lien", async ({ page }) => {
    await signIn(page, gerant.email);
    await page.getByRole("link", { name: "Équipe" }).first().click();
    await page.getByLabel("Adresse e-mail").fill(nego.email);
    await page.getByLabel("Rôle").selectOption("negociateur");
    await page.getByRole("button", { name: "Créer l'invitation" }).click();
    const link = page.getByLabel("Lien d'invitation", { exact: true });
    await expect(link).toBeVisible();
    invitationLink = await link.inputValue();
    expect(invitationLink).toMatch(/\/invitation\/[0-9a-f-]{36}$/);
    await expect(page.getByText(`Invitations en attente (1)`)).toBeVisible();
  });

  test("le négociateur accepte l'invitation et n'a pas les droits du gérant", async ({ page }) => {
    await page.goto(new URL(invitationLink).pathname);
    await page.getByRole("link", { name: "Créer un compte" }).click();
    await signUp(page, nego);
    await expect(page.getByRole("heading", { name: `Rejoindre ${agency}` })).toBeVisible();
    await page.getByRole("button", { name: "Accepter l'invitation" }).click();
    await expect(page.getByRole("heading", { name: "Bonjour Hugo" })).toBeVisible();

    // Pas de journal d'audit dans le menu, et la page refuse l'accès.
    await expect(page.getByRole("link", { name: "Journal d'audit" })).toHaveCount(0);
    await page.goto("/app/journal");
    await expect(page.getByText("réservé au gérant et aux managers")).toBeVisible();

    // Paramètres en lecture seule, équipe sans actions.
    await page.goto("/app/parametres");
    await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    await page.goto("/app/equipe");
    await expect(page.getByRole("button", { name: "Créer l'invitation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retirer" })).toHaveCount(0);

    // Export complet de l'agence : réservé au gérant (ni carte, ni accès direct).
    await page.goto("/app/parametres");
    await expect(page.getByRole("heading", { name: "Exporter les données de l'agence" })).toHaveCount(0);
    expect((await page.request.get("/api/v1/export/contacts")).status()).toBe(403);
  });

  test("les routes HTTP de gestion d'agence sont fermées, même connecté", async ({ page }) => {
    await signIn(page, nego.email);
    for (const path of ["update-member-role", "invite-member", "remove-member", "set-active", "list-members"]) {
      const response = await page.request.post(`/api/auth/organization/${path}`, { data: {} });
      expect(response.status(), path).toBe(404);
    }
  });

  test("le gérant change le rôle et le retrouve dans le journal d'audit", async ({ page }) => {
    await signIn(page, gerant.email);
    await page.goto("/app/equipe");
    await page.getByLabel(`Rôle de ${nego.name}`).selectOption("manager");
    await expect(page.getByText("Rôle modifié.")).toBeVisible();
    await page.goto("/app/parametres");
    await page.getByLabel("Privés").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

    await page.goto("/app/journal");
    for (const label of ["Agence créée", "Invitation envoyée", "Invitation acceptée", "Rôle modifié", "Paramètres modifiés"]) {
      await expect(page.getByRole("cell", { name: label, exact: true })).toBeVisible();
    }
  });
});

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/app$/);
}
