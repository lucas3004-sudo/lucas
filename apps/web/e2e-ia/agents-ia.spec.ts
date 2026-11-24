/**
 * Les 4 fonctions d'IA de bout en bout (D-069), avec un faux serveur d'IA local (aucun appel réel) :
 * rédaction d'annonce (approuvée par le gérant), analyse d'annonce, récap rédigé, relances. On
 * vérifie aussi ce qui part vers l'IA : jamais la rue, ni le nom, l'e-mail ou le téléphone d'un client.
 */
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const password = "motdepasse-de-test-1234";
const gerant = { name: "Iris Gérante", email: `ia-gerant-${run}@test.invalid` };
const nego = { name: "Noé Négociateur", email: `ia-nego-${run}@test.invalid` };
const agency = `Agence IA ${run}`;
const buyer = { first: "Bastien", last: `Acquéreur${run}`, email: `bastien-${run}@test.invalid`, phone: "06 98 76 54 32" };
const OWNER_URL = process.env.E2E_DATABASE_URL_OWNER ?? "postgres://app_owner:dev_owner@127.0.0.1:54320/immopilot";
let invitation = "";

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
  await expect(page.getByRole("heading", { name: /^Bonjour/ })).toBeVisible();
}
async function newProperty(page: Page, query: string, option: RegExp, surface: string, price: string) {
  await page.goto("/app/proprietes/nouveau");
  await page.getByLabel("Adresse du bien").fill(query);
  await page.getByRole("option", { name: option }).click();
  await page.getByLabel("Surface habitable (m²)").fill(surface);
  await page.getByLabel("Pièces principales").fill("3");
  await page.getByLabel("Prix affiché (€)").fill(price);
  await page.getByRole("button", { name: "Créer le bien" }).click();
  await expect(page.getByRole("heading", { name: option })).toBeVisible({ timeout: 20_000 });
}
const missionRow = (page: Page, agent: string) => page.getByRole("row").filter({ hasText: agent }).first();

test("le gérant crée son agence, prend une formule avec IA et invite un négociateur", async ({ page }) => {
  await page.goto("/inscription");
  await signUp(page, gerant);
  await page.getByLabel("Nom de l'agence").fill(agency);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Iris" })).toBeVisible();
  // Formule attribuée par l'exploitant (comme après un paiement) : l'Essai n'inclut pas l'IA.
  const db = new pg.Client({ connectionString: OWNER_URL });
  await db.connect();
  await db.query(
    `INSERT INTO app.agency_plans (org_id, plan, note) SELECT id, 'agency', 'test IA' FROM iam.organization WHERE name = $1
     ON CONFLICT (org_id) DO UPDATE SET plan = 'agency'`,
    [agency],
  );
  await db.end();
  await page.goto("/app/equipe");
  await page.getByLabel("Adresse e-mail").fill(nego.email);
  await page.getByLabel("Rôle").selectOption("negociateur");
  await page.getByRole("button", { name: "Créer l'invitation" }).click();
  invitation = await page.getByLabel("Lien d'invitation", { exact: true }).inputValue();
});

test("le négociateur rejoint l'agence", async ({ page }) => {
  await page.goto(new URL(invitation).pathname);
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await signUp(page, nego);
  await page.getByRole("button", { name: "Accepter l'invitation" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Noé" })).toBeVisible();
});

test("1. rédaction d'annonce : l'agent propose, le gérant relit et approuve, l'annonce est enregistrée", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, gerant.email);
  await newProperty(page, "8 boulevard du port amiens", /8 Boulevard du Port 80000 Amiens/, "62", "250000");
  await page.goto("/app/agents");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Rédacteur d'annonces" }) });
  await expect(card.getByText("Assisté par l'IA (rédaction et analyse)")).toBeVisible();
  await card.getByRole("button", { name: "Lancer Rédacteur d'annonces" }).click();
  await expect(missionRow(page, "Rédacteur d'annonces")).toContainText("1 bien(s) sans annonce, 1 annonce(s) rédigée(s) et proposée(s) à l'approbation.");

  await page.goto("/app/agents/approbations");
  const request = page.getByRole("listitem").filter({ hasText: "Enregistrer une annonce rédigée par l'IA" });
  await expect(request.getByTestId("annonce-proposee")).toContainText("[Réponse de test] Appartement 3 pièces lumineux");
  await request.getByRole("button", { name: "Approuver" }).click();
  await expect(request.getByText("Approuvée")).toBeVisible();

  await page.goto("/app/proprietes");
  await page.getByRole("link", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
  await page.getByRole("link", { name: "Annonce", exact: true }).click();
  await expect(page.getByTestId("listing-text")).toContainText("[Réponse de test] Appartement de trois pièces");
  // Le bien a maintenant une annonce : rien à rédiger au passage suivant.
  await page.goto("/app/agents");
  await page.getByRole("button", { name: "Lancer Rédacteur d'annonces" }).click();
  await expect(missionRow(page, "Rédacteur d'annonces")).toContainText("0 bien(s) sans annonce");
});

test("2. analyse d'annonce : le responsable reçoit l'analyse, une seule fois par prix", async ({ page }) => {
  await signIn(page, gerant.email);
  await page.goto("/app/agents");
  await page.getByRole("button", { name: "Lancer Analyse des annonces" }).click();
  await expect(missionRow(page, "Analyse des annonces")).toContainText("1 bien(s) à analyser, 1 analyse(s) envoyée(s) aux responsables.");
  await page.goto("/app/taches");
  await expect(page.getByText("Analyse de l'annonce (prix bien placé) : 8 Boulevard du Port 80000 Amiens")).toBeVisible();
  await expect(page.getByText(/\[Réponse de test\] Points forts/)).toBeVisible();
  await page.goto("/app/agents");
  await page.getByRole("button", { name: "Lancer Analyse des annonces" }).click();
  await expect(missionRow(page, "Analyse des annonces")).toContainText("0 bien(s) à analyser");
});

test("3. récap rédigé par l'IA sur l'accueil", async ({ page }) => {
  await signIn(page, gerant.email);
  await page.goto("/app?recap=semaine");
  await page.getByRole("button", { name: "Résumer avec l'IA" }).click();
  await expect(page.getByTestId("recap-ia")).toContainText("[Réponse de test] Cette semaine");
});

test("4. relances : le négociateur reçoit l'alerte et le message prêt pour son acquéreur", async ({ page }) => {
  test.setTimeout(120_000);
  // Le gérant crée l'acquéreur du négociateur et son profil, puis un bien qui correspond.
  await signIn(page, gerant.email);
  await page.goto("/app/contacts/nouveau");
  await page.getByLabel("Prénom").fill(buyer.first);
  await page.getByLabel("Nom", { exact: true }).fill(buyer.last);
  await page.getByLabel("E-mail").fill(buyer.email);
  await page.getByLabel("Téléphone").fill(buyer.phone);
  await page.getByLabel("Acquéreur").check();
  await page.getByLabel("Responsable").selectOption({ label: nego.name });
  await page.getByRole("button", { name: "Créer le contact" }).click();
  await expect(page.getByRole("heading", { name: `${buyer.first} ${buyer.last}` })).toBeVisible();
  await page.getByText("Ajouter un profil de recherche").click();
  await page.getByLabel("Budget maximal (€)").fill("300000");
  await page.getByLabel("Surface minimale (m²)").fill("50");
  await page.getByLabel("Pièces minimum").fill("3");
  await page.getByLabel("Codes postaux recherchés").fill("80000");
  await page.getByRole("button", { name: "Ajouter le profil" }).click();
  await expect(page.getByText("Profil de recherche enregistré.")).toBeVisible({ timeout: 20_000 });
  await newProperty(page, "10 boulevard du port amiens", /10 Boulevard du Port 80000 Amiens/, "64", "255000");

  await signIn(page, nego.email);
  await page.goto("/app/agents");
  await page.getByRole("button", { name: "Lancer Relances" }).click();
  await expect(missionRow(page, "Relances")).toContainText("1 message(s) préparé(s) pour les acquéreurs.");
  await page.goto("/app/taches");
  await expect(page.getByText(/Message proposé par l'agent Relances/)).toBeVisible();
  await expect(page.getByText(/Bonjour \[Prénom\],/)).toBeVisible();
});

test("le chat IA répond quand l'IA est allumée", async ({ page }) => {
  await signIn(page, nego.email);
  await page.goto("/app/assistant");
  await page.getByLabel("Votre question").fill("Comment ajouter un bien ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log", { name: "Conversation avec l'assistant" })).toContainText("[Réponse de test] Pour ajouter un bien");
});

test("rien de personnel n'est parti vers l'IA, et chaque appel est compté", async ({ page, request }) => {
  const requests = (await (await request.get("http://127.0.0.1:3999/__requetes")).json()) as Array<{ system: unknown }>;
  const all = JSON.stringify(requests);
  // Aucune donnée de contact, nulle part (chat compris).
  for (const secret of [buyer.first, buyer.last, buyer.email, buyer.phone, "98 76 54 32"]) expect(all).not.toContain(secret);
  // Les agents IA n'envoient que la ville et le code postal du bien, jamais la rue (le chat, lui,
  // connaît l'adresse des biens de l'agence pour pouvoir en parler, D-063).
  const agents = requests.filter((r) => typeof r.system === "string" && r.system.includes("Tâche :"));
  expect(agents).toHaveLength(4);
  expect(JSON.stringify(agents)).toContain("Amiens (80000)");
  expect(JSON.stringify(agents)).not.toContain("Boulevard du Port");
  // Consommation : les appels réussis apparaissent dans la formule du gérant.
  await signIn(page, gerant.email);
  await page.goto("/app/formule");
  await expect(page.getByTestId("usage-annonces_ia")).toContainText(/^1 sur 200/);
  // Analyse, récap, relance et une question au chat : 4 échanges réussis.
  await expect(page.getByTestId("usage-copilot")).toContainText(/^4 sur 1\s?200/);
});
