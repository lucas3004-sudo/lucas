# Sécurité du compte : double authentification

Date : 2026-11-21.

## Fonctionnement
- **Activation** depuis « Sécurité du compte » (lien sous le nom, en bas du menu) :
  1. saisir son mot de passe ;
  2. scanner le QR code avec une application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…) ou saisir la clé à la main ;
  3. noter les **codes de secours** ;
  4. saisir un premier code pour terminer. Tant que ce code n'est pas validé, la double authentification n'est pas activée.
- **Connexion** : après le mot de passe, une page demande le code à 6 chiffres, ou un code de secours si le téléphone est perdu. Un code de secours ne sert qu'une fois.
- **Désactivation** : avec le mot de passe.
- **Rappel** : un bandeau invite le gérant et les managers à l'activer, car ils voient toutes les données de l'agence.

## Sécurité
- Standard TOTP (RFC 6238) de la bibliothèque Better Auth. Le secret et les codes de secours sont chiffrés en base avec la clé du serveur.
- Les essais sont limités à 10 par minute, avec un blocage temporaire après des erreurs répétées.
- Les pages de l'agence restent inaccessibles tant que la seconde étape n'est pas validée (vérifié par un test de bout en bout).
- Le QR code est généré dans le navigateur : la clé n'est envoyée à aucun service extérieur.

## Tests
Scénario de bout en bout :
- activation avec un code calculé selon la RFC 6238 ;
- connexion refusée avec un code incorrect, puis acceptée avec le bon ;
- connexion avec un code de secours ;
- accès à l'agence refusé entre les deux étapes.
