/**
 * Guide d'utilisation d'ImmoPilot (D-063). Il sert deux fois : affiché tel quel sur la page de
 * l'assistant (utile même sans IA), et donné à l'IA pour qu'elle explique où cliquer.
 * À tenir à jour quand une page change.
 */

export interface GuideEntry {
  question: string;
  answer: string;
  href?: string;
}

export const GUIDE: GuideEntry[] = [
  { question: "Ajouter un bien", answer: "Menu « Biens », bouton « Nouveau bien » : tapez l'adresse et choisissez-la dans la liste, puis la surface, les pièces et le prix. Le bien apparaît aussitôt sur la carte.", href: "/app/proprietes/nouveau" },
  { question: "Baisser le prix d'un bien", answer: "Ouvrez le bien (menu « Biens »), modifiez « Prix affiché » puis « Modifier le prix ». La baisse apparaît dans l'historique de la fiche et dans le récap.", href: "/app/proprietes" },
  { question: "Voir la fiche d'un bien comme une annonce", answer: "Sur la page d'un bien, « Voir la fiche » ; sur la carte, cliquez sur le bien puis « Voir la fiche » : photos, description, historique, analyse du marché.", href: "/app/carte" },
  { question: "Ajouter des photos", answer: "Page du bien, partie « Photos » : choisissez les images. Les données de localisation des photos sont supprimées automatiquement.", href: "/app/proprietes" },
  { question: "Rédiger l'annonce et vérifier les mentions obligatoires", answer: "Page du bien, « Annonce et mentions » : titre, description, DPE, charges… ImmoPilot indique les mentions légales qui manquent.", href: "/app/proprietes" },
  { question: "Ajouter un contact ou un acquéreur", answer: "Menu « Contacts », « Nouveau contact ». Pour un acquéreur, cochez « Acquéreur » puis ajoutez son profil de recherche (budget, lieu, surface…). ImmoPilot lui trouve les biens qui correspondent.", href: "/app/contacts/nouveau" },
  { question: "Importer mes contacts ou mes biens", answer: "Menu « Contacts » ou « Biens », bouton « Importer (CSV) » : un fichier Excel enregistré en CSV suffit.", href: "/app/contacts" },
  { question: "Trouver les acquéreurs pour un bien", answer: "Page du bien, partie « Acquéreurs correspondants » : les profils de l'agence classés par compatibilité, avec l'explication. Les contacts privés d'un collègue restent anonymes ; « Prévenir » envoie une tâche au collègue concerné.", href: "/app/proprietes" },
  { question: "Trouver les biens pour un acquéreur", answer: "Fiche du contact, partie « Profils de recherche » : les meilleurs biens de l'agence pour ses critères, du plus au moins compatible.", href: "/app/contacts" },
  { question: "Chercher sur la carte", answer: "Menu « Carte » : lieu, rayon, prix, surface, DPE, équipements. « Bonnes affaires seulement » montre les biens sous le prix du marché. Les points bleus sont des ventes réelles (DVF).", href: "/app/carte" },
  { question: "Estimer un bien", answer: "Outils, « Estimations », « Nouveau dossier » : à partir de l'adresse, ImmoPilot calcule une fourchette avec les ventes réelles autour, les risques et le DPE. C'est un repère, pas une expertise.", href: "/app/biens/nouveau" },
  { question: "Simuler un investissement locatif", answer: "Outils, « Investissement » : loyer, crédit, charges, fiscalité ; toutes les hypothèses sont visibles et modifiables.", href: "/app/investissement" },
  { question: "Planifier une visite", answer: "Menu « Agenda », « Nouveau rendez-vous » (type Visite, avec le bien et le contact). Il s'ajoute à votre agenda habituel via « Exporter mes rendez-vous (.ics) ».", href: "/app/agenda" },
  { question: "Faire le compte rendu d'une visite", answer: "Après la visite, elle apparaît en haut de l'agenda : « Compte rendu ». ImmoPilot prépare un texte pour le vendeur, sans le nom des visiteurs.", href: "/app/agenda" },
  { question: "Suivre une vente de l'offre à l'acte", answer: "Page du bien, « Ouvrir une affaire » ; puis menu « Affaires » : étapes, délais calculés (rétractation, prêt, acte) et pièces à réunir.", href: "/app/affaires" },
  { question: "Suivre la fin de mes mandats", answer: "Page du bien, partie « Mandat » : numéro, dates. Un rappel est créé 30 jours avant la fin, et le récap vous prévient.", href: "/app/proprietes" },
  { question: "Que font les agents ?", answer: "Menu « Agents » : chaque jour, tout seuls, ils vérifient la qualité des données, préviennent les collègues des acquéreurs correspondants, surveillent échéances et mandats, détectent les doublons. Vous pouvez aussi les lancer à la main. Rien d'important n'est fait sans votre accord : « Approbations ».", href: "/app/agents" },
  { question: "Trouver des vendeurs (page « Estimez votre bien »)", answer: "Agence, « Paramètres », partie « Page Estimez votre bien » : ouvrez la page, choisissez qui reçoit les demandes et copiez le lien pour votre site, Google ou vos réseaux. Le propriétaire obtient une estimation indicative et peut demander à être rappelé, avec son accord : il arrive dans vos contacts (vendeur), un bien « prospect » est créé et une tâche de rappel vous attend.", href: "/app/parametres" },
  { question: "Publier une annonce sur SeLoger, Leboncoin…", answer: "Page du bien, « Annonce », partie « Diffusion » : copiez le titre et la description, téléchargez le pack (texte et photos), publiez avec l'abonnement de l'agence, puis cliquez « Publiée » (avec le lien). Quand le bien est vendu, ImmoPilot vous rappelle de retirer chaque annonce.", href: "/app/proprietes" },
  { question: "Inviter un collègue", answer: "Agence, « Équipe » : saisissez son e-mail et son rôle, puis envoyez-lui le lien d'invitation.", href: "/app/equipe" },
  { question: "Voir ma consommation et ma formule", answer: "Agence, « Formule » : consommation de l'agence et quotas de chaque formule. « Choisir ou gérer l'abonnement » pour payer ou changer.", href: "/app/formule" },
  { question: "Continuer l'IA après le forfait (crédits à l'usage)", answer: "Agence, « Formule », partie « Crédits IA à l'usage » : au-delà des échanges inclus, 2 € les 100 échanges et 0,20 € l'annonce, ajoutés à la facture suivante. Le gérant choisit un plafond mensuel (30 € par défaut, 0 pour désactiver). Il faut un abonnement payant.", href: "/app/formule" },
  { question: "Pourquoi les agents ne trouvent rien ?", answer: "Les agents passent tout seuls chaque jour, à votre première connexion. S'ils ne signalent rien, c'est souvent que l'agence n'a pas encore de biens ni de contacts : ajoutez-les ou importez-les (fichier Excel).", href: "/app/agents" },
  { question: "Exporter toutes les données de l'agence", answer: "Agence, « Paramètres », partie export : un fichier CSV par type de données (gérant, avec double authentification activée).", href: "/app/parametres" },
  { question: "Sécuriser mon compte", answer: "En bas du menu, « Sécurité du compte » : activez la double authentification avec une application comme Google Authenticator.", href: "/app/securite" },
];

export function guideAsText(): string {
  return GUIDE.map((g) => `- ${g.question} : ${g.answer}${g.href ? ` (page ${g.href})` : ""}`).join("\n");
}
