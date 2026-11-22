"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Client navigateur : connexion, inscription et double authentification (routes HTTP limitées
 * en débit). Un compte protégé par la double authentification est envoyé vers la saisie du code.
 */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const next = new URLSearchParams(window.location.search).get("invitation");
        window.location.href = `/connexion/verification${next ? `?invitation=${encodeURIComponent(next)}` : ""}`;
      },
    }),
  ],
});

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cette adresse e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cette adresse e-mail.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 12 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long (128 caractères au maximum).",
  INVALID_EMAIL: "Adresse e-mail invalide.",
  INVALID_CODE: "Code incorrect.",
  INVALID_TWO_FACTOR_COOKIE: "La vérification a expiré : reconnectez-vous.",
  INVALID_BACKUP_CODE: "Code de secours incorrect ou déjà utilisé.",
  INVALID_PASSWORD: "Mot de passe incorrect.",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "Trop d'essais : patientez avant de réessayer.",
  ACCOUNT_TEMPORARILY_LOCKED: "Trop d'essais incorrects : compte bloqué temporairement. Réessayez plus tard.",
  TOTP_ALREADY_ENABLED: "La double authentification est déjà activée.",
  INVALID_ORIGIN: "Cette adresse du site n'est pas reconnue pour la connexion : utilisez l'adresse principale du site.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return "Une erreur est survenue.";
  if (error.status === 429) return "Trop de tentatives. Patientez une minute avant de réessayer.";
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  // Code technique affiché (jamais de détail sensible) : il permet de diagnostiquer à distance.
  const code = error.code ?? (error.status ? `HTTP ${error.status}` : null);
  return `Une erreur est survenue. Réessayez.${code ? ` (code : ${code})` : ""}`;
}
