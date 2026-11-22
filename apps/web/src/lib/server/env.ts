/** Lecture des variables d'environnement obligatoires, avec un message clair si l'une manque. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example).`);
  }
  return value;
}

/**
 * Adresse publique de l'application. Ordre : BETTER_AUTH_URL si renseignée, sinon l'adresse
 * de production fournie automatiquement par Vercel, sinon le poste local.
 */
export function appUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.BETTER_AUTH_URL ?? (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

/**
 * Adresses d'où le navigateur peut appeler l'authentification (protection contre les requêtes
 * venues d'autres sites). En plus de l'adresse principale : l'adresse propre au déploiement Vercel
 * et celle de sa branche, toutes deux fournies par Vercel et propres À CE projet (jamais de joker
 * sur vercel.app, où n'importe qui peut créer un site). AUTH_TRUSTED_ORIGINS permet d'en ajouter
 * (domaine personnalisé), séparées par des virgules.
 */
export function trustedOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const hosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter((h): h is string => Boolean(h));
  const extra = (env.AUTH_TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter((o) => /^https:\/\/[a-z0-9.-]+$/i.test(o));
  const base = (env.BETTER_AUTH_URL ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");
  return [...new Set([base, ...hosts.map((h) => `https://${h}`), ...extra])];
}
