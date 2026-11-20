/**
 * Investment Studio de bout en bout (critère F7), sur le scénario n° 9 calculé à la main
 * (packages/domain/src/invest/simulate.test.ts) : l'écran doit afficher les mêmes chiffres.
 */
import { expect, test } from "@playwright/test";

const run = Date.now().toString(36);

test("un négociateur simule un investissement locatif, hypothèses visibles et modifiables", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill("Ivan Investisseur");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`invest-${run}@test.invalid`);
  await page.getByLabel("Mot de passe").fill("motdepasse-de-test-1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByLabel("Nom de l'agence").fill(`Agence Invest ${run}`);
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Ivan" })).toBeVisible();

  await page.getByRole("link", { name: "Investment Studio" }).first().click();
  await expect(page.getByText("Saisissez au moins le prix d'achat")).toBeVisible();

  const fill = async (label: string, value: string) => page.getByLabel(label, { exact: false }).fill(value);
  await fill("Prix d'achat", "150 000");
  await fill("Frais d'acquisition", "8");
  await fill("Travaux", "10000");
  await fill("Mobilier", "3000");
  await fill("Loyer mensuel hors charges", "850");
  await fill("Vacance locative", "0,5");
  await fill("Taxe foncière", "900");
  await fill("Charges de copropriété non récupérables", "600");
  await fill("Assurance propriétaire non occupant", "120");
  await fill("Entretien (provision)", "300");
  await fill("Apport", "25000");
  await fill("Taux du prêt", "4");
  await fill("Durée du prêt", "25");
  await fill("Assurance emprunteur", "0,25");
  await page.getByRole("button", { name: "Calculer" }).click();

  await expect(page.getByText("5,83 %").first()).toBeVisible(); // 10 200 / 175 000
  await expect(page.getByText("4,49 %").first()).toBeVisible(); // 7 855 / 175 000
  await expect(page.getByText(/^−168\s€$/).first()).toBeVisible();
  await expect(page.getByText(/^175\s000\s€$/)).toBeVisible();
  await expect(page.getByText(/^792\s€$/)).toBeVisible(); // mensualité 791,76
  await expect(page.getByRole("table")).toContainText("+10 %");
  await expect(page.getByText(/ni un conseil en investissement ni un conseil fiscal/)).toBeVisible();
  if (process.env.E2E_CAPTURES) {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.screenshot({ path: `${process.env.E2E_CAPTURES}/12-investment-studio.png`, fullPage: true });
  }

  // La simulation est dans le lien ; une valeur hors limites est signalée, pas corrigée.
  expect(page.url()).toContain("price=150+000");
  await fill("Durée du prêt", "45");
  await page.getByRole("button", { name: "Calculer" }).click();
  await expect(page.getByText("Valeur invalide ou hors limites.")).toBeVisible();
  await expect(page.getByText("Corrigez les valeurs signalées")).toBeVisible();
});
