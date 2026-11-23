/**
 * Politique de sécurité du contenu (CSP) stricte, avec un « nonce » différent à chaque requête :
 * seuls les scripts émis par l'application (qui portent ce nonce) s'exécutent ; tout script
 * injecté (XSS) est bloqué par le navigateur. Les styles restent autorisés en ligne (Tailwind,
 * attributs style de React) : une injection de style est bien moins dangereuse qu'un script.
 */
import { NextResponse, type NextRequest } from "next/server";

export function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Fond de carte IGN (Géoplateforme, sans clé) pour la page « Carte ».
    "img-src 'self' data: blob: https://data.geopf.fr",
    "font-src 'self' data:",
    // Carte vectorielle IGN : style, tuiles, polices et pictogrammes ; moteur de carte dans un « worker ».
    "connect-src 'self' https://data.geopf.fr",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages seulement : ni API (politique fixe dans next.config.ts), ni fichiers statiques, ni préchargements.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
