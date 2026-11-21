/**
 * En-têtes de sécurité : CSP stricte avec un nonce différent à chaque page, scripts de
 * l'application exécutés (la page devient interactive), script injecté bloqué ; API fermée.
 */
import { expect, test } from "@playwright/test";

test("chaque page reçoit une CSP à nonce unique, et un script sans nonce est bloqué", async ({ page }) => {
  const first = await page.goto("/connexion");
  const csp = first!.headers()["content-security-policy"]!;
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  const second = await page.goto("/connexion");
  expect(second!.headers()["content-security-policy"]).not.toBe(csp);

  // Les scripts de l'application s'exécutent : le formulaire réagit (validation côté client).
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/incorrect|invalide|erreur/i).first()).toBeVisible();

  // Injection typique (XSS) : du HTML avec un gestionnaire d'événement en ligne. La CSP le bloque.
  const executed = await page.evaluate(async () => {
    (window as unknown as { injected?: boolean }).injected = false;
    const div = document.createElement("div");
    div.innerHTML = '<img src="/inexistant.png" onerror="window.injected = true">';
    document.body.appendChild(div);
    await new Promise((r) => setTimeout(r, 300));
    return (window as unknown as { injected?: boolean }).injected;
  });
  expect(executed).toBe(false);
});

test("les routes d'API ont une CSP fermée et nosniff", async ({ request }) => {
  const res = await request.get("/api/v1/adresses?q=amiens");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("état de santé public : base joignable et à jour, sans détail technique", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.statut).toBe("ok");
  expect(body.migrations.appliquees).toBeGreaterThanOrEqual(body.migrations.attendues);
  expect(JSON.stringify(body)).not.toMatch(/\.sql/);
});
