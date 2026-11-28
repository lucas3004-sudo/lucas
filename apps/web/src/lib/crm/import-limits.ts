/**
 * Limites des fichiers importés (un fichier « use server » ne peut exporter que des fonctions).
 * Le ZIP reste sous la limite des actions serveur (next.config.ts : 3 Mo) : au-delà, Next.js
 * refuse l'envoi avant notre code, avec une erreur incompréhensible pour l'utilisateur.
 */
export const MAX_CSV_BYTES = 1_000_000;
export const MAX_ZIP_BYTES = 2_800_000;

/** Message d'erreur si le fichier choisi est trop lourd, sinon chaîne vide (contrôle du navigateur). */
export function importFileTooLarge(name: string, size: number): string {
  if (/\.zip$/i.test(name)) {
    return size > MAX_ZIP_BYTES
      ? "Fichier ZIP trop volumineux (2,8 Mo au maximum) : envoyez seulement le fichier Annonces.csv qu'il contient."
      : "";
  }
  return size > MAX_CSV_BYTES ? "Fichier trop volumineux (1 Mo au maximum)." : "";
}
