/**
 * Instance Better Auth du serveur (une seule par processus, y compris en rechargement à chaud).
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { requireEnv } from "../server/env";
import { authOptions, createAuthPool } from "./options";

function createAuth() {
  const options = authOptions(createAuthPool(requireEnv("DATABASE_URL_AUTH")));
  return betterAuth({
    ...options,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    // nextCookies doit rester le dernier plugin : il pose les cookies depuis les actions serveur.
    plugins: [...options.plugins, nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { immopilotAuth?: Auth };

export function getAuth(): Auth {
  globalForAuth.immopilotAuth ??= createAuth();
  return globalForAuth.immopilotAuth;
}
