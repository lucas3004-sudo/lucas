"use client";
import { createAuthClient } from "better-auth/react";

/** Client navigateur : uniquement connexion et inscription (routes HTTP limitées en débit). */
export const authClient = createAuthClient();

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cette adresse e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cette adresse e-mail.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 12 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long (128 caractères au maximum).",
  INVALID_EMAIL: "Adresse e-mail invalide.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return "Une erreur est survenue.";
  if (error.status === 429) return "Trop de tentatives. Patientez une minute avant de réessayer.";
  return (error.code && MESSAGES[error.code]) || "Une erreur est survenue. Réessayez.";
}
