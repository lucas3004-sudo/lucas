import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ImmoPilot AI", template: "%s · ImmoPilot AI" },
  description: "L'équipe d'assistants IA de votre agence immobilière.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1eb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0a08" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lire l'en-tête rend chaque page dynamique : indispensable pour qu'elle reçoive son nonce CSP.
  await headers();
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
