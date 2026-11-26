/**
 * Audit automatique d'accessibilité (phase 9) : chaque page principale est analysée par axe-core
 * selon les règles WCAG 2.1 niveaux A et AA, en thème clair puis en thème sombre.
 * Échec si une violation « grave » ou « critique » est trouvée. axe-core ne détecte qu'une
 * partie des problèmes (environ un tiers à la moitié) : il ne remplace pas un audit manuel.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);
const PUBLIC_PAGES = ["/", "/connexion", "/inscription"];
const APP_PAGES = [
  "/app", "/app/contacts", "/app/contacts/nouveau", "/app/proprietes", "/app/proprietes/nouveau", "/app/proprietes/nouveau?prospection=1",
  "/app/prospection", "/app/biens", "/app/biens/nouveau",
  "/app/affaires", "/app/agenda", "/app/taches", "/app/investissement", "/app/qualite", "/app/agents", "/app/agents/approbations",
  "/app/equipe", "/app/parametres", "/app/formule", "/app/pilotage", "/app/journal", "/app/securite", "/app/carte", "/app/assistant", "/abonnement",
];

async function audit(page: Page, path: string | null) {
  if (path) await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Attendre la fin des animations d'entrée (les animations sans fin, comme les lueurs, sont ignorées).
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map((a) => a.finished.catch(() => null))),
  );
  // Certaines transitions (ouverture du menu mobile, sur un pseudo-élément) n'apparaissent pas dans
  // getAnimations() : on attend aussi que la mise en page ne bouge plus pendant plusieurs images.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = "";
        let stable = 0;
        const started = performance.now();
        const tick = () => {
          const sizes = [...document.querySelectorAll("details")].map((d) => d.getBoundingClientRect().height).join(",") + `|${document.documentElement.scrollHeight}`;
          stable = sizes === last ? stable + 1 : 0;
          last = sizes;
          if (stable >= 5 || performance.now() - started > 3000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  for (const v of results.violations) if (process.env.A11Y_VERBOSE) console.log(`[a11y] ${path ?? page.url()} ${v.id} ${v.impact} ${v.nodes.length}`);
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${path ?? page.url()} : ${v.id} (${v.impact}) — ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("contrôle : l'audit détecte bien une violation injectée (sinon un audit vide passerait)", async ({ page }) => {
  await page.goto("/connexion");
  await page.evaluate(() => {
    const b = document.createElement("button"); // bouton sans nom accessible
    document.body.append(b);
    const i = document.createElement("img"); // image sans texte de remplacement
    i.src = "/favicon.ico";
    document.body.append(i);
  });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.passes.length).toBeGreaterThan(10);
  expect(results.violations.map((v) => v.id)).toEqual(expect.arrayContaining(["button-name", "image-alt"]));
});

test("clavier : lien d'évitement en premier, focus visible, menu utilisable sans souris", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Kim Clavier");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`clavier-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Clavier ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Kim" })).toBeVisible();

  await page.goto("/app");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  // Contour de focus visible (2 px), défini pour tous les éléments au clavier.
  expect(await skip.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenu")).toBeFocused();

  // Navigation au clavier dans le menu : Contacts atteint par Tab, ouvert par Entrée.
  await page.goto("/app");
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    if (await page.getByRole("link", { name: "Contacts" }).first().evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.getByRole("link", { name: "Contacts" }).first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/contacts$/);
});

test("mobile (390 px) : pages et menu ouvert sans violation grave, sans défilement horizontal", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const problems: string[] = [];
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Mia Mobile");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`mobile-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Mobile ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Mia" })).toBeVisible();
  for (const path of ["/app", "/app/contacts", "/app/agenda", "/app/formule", "/app/investissement"]) {
    problems.push(...(await audit(page, path)));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`${path} : défilement horizontal de ${overflow} px`);
  }
  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Contacts" }).last()).toBeVisible();
  problems.push(...(await audit(page, null)));
  expect(problems, problems.join("\n")).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`accessibilité WCAG 2.1 AA, thème ${scheme === "light" ? "clair" : "sombre"} : aucune violation grave`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    const problems: string[] = [];
    for (const path of PUBLIC_PAGES) problems.push(...(await audit(page, path)));
    // Page d'accueil entière : on la parcourt pour révéler chaque section, puis on l'audite.
    await page.goto("/");
    for (let y = 0; y < (await page.evaluate(() => document.documentElement.scrollHeight)); y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1500);
    problems.push(...(await audit(page, null)));
    // Mouvements réduits : la mise en page statique doit rester accessible.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    problems.push(...(await audit(page, "/")));
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "no-preference" });

    await page.goto("/inscription");
    await page.getByLabel("Nom et prénom").fill("Alix Accessible");
    await page.getByLabel("Adresse e-mail professionnelle").fill(`a11y-${scheme}-${run}@test.invalid`);
    await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByLabel("Nom de l'agence")).toBeVisible();
    problems.push(...(await audit(page, null))); // création de l'agence
    await page.getByLabel("Nom de l'agence").fill(`Agence A11y ${scheme} ${run}`);
    await page.getByRole("button", { name: "Créer l'agence" }).click();
    await expect(page.getByRole("heading", { name: "Bonjour Alix" })).toBeVisible();

    // Un contact, pour auditer aussi une fiche.
    await page.goto("/app/contacts/nouveau");
    await page.getByLabel("Prénom").fill("Paul");
    await page.getByLabel("Nom", { exact: true }).fill("Audit");
    await page.getByLabel("Acquéreur").check();
    await page.getByRole("button", { name: "Créer le contact" }).click();
    await expect(page.getByRole("heading", { name: "Paul Audit" })).toBeVisible();
    const contactPath = new URL(page.url()).pathname;

    // Un bien (adresse vérifiée par la BAN), pour auditer sa fiche et son annonce.
    await page.goto("/app/proprietes/nouveau");
    await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
    await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
    await page.getByLabel("Surface habitable (m²)").fill("62");
    await page.getByLabel("Pièces principales").fill("3");
    await page.getByRole("button", { name: "Créer le bien" }).click();
    await expect(page.getByRole("heading", { name: "8 Boulevard du Port 80000 Amiens" })).toBeVisible({ timeout: 20_000 });
    const propertyPath = new URL(page.url()).pathname;

    // Un dossier de bien (comparables, estimation, risques), la page la plus riche.
    await page.goto("/app/biens/nouveau");
    await page.getByLabel("Adresse du bien").fill("8 boulevard du port amiens");
    await page.getByRole("option", { name: /8 Boulevard du Port 80000 Amiens/ }).click();
    await page.getByLabel("Type de bien").selectOption("Appartement");
    await page.getByLabel("Surface habitable (m²)").fill("60");
    await page.getByRole("button", { name: "Créer le dossier" }).click();
    await expect(page.getByText("Estimation indicative, pas une expertise.")).toBeVisible({ timeout: 45_000 });
    const dossierPath = new URL(page.url()).pathname;

    for (const path of [...APP_PAGES, contactPath, propertyPath, `${propertyPath}/annonce`, `${propertyPath}/fiche`, dossierPath]) problems.push(...(await audit(page, path)));
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
