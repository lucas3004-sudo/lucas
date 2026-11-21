import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// En-têtes de sécurité (docs/phase-2/architecture.md, section 7). La CSP des pages, avec un nonce
// par requête, est posée par src/proxy.ts. Les routes d'API reçoivent une CSP fixe très fermée.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const config: NextConfig = {
  transpilePackages: ["@immopilot/agents", "@immopilot/db", "@immopilot/domain", "@immopilot/integrations"],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Import CSV : fichier de 1 Mo au plus, renvoyé une fois pour la confirmation.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" }] },
    ];
  },
};

export default config;
