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
