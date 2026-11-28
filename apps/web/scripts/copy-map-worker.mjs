/* global console */
// MapLibre 6 dessine la carte dans un « worker », livré comme un fichier à part
// (maplibre-gl-worker.mjs). Next.js ne le publie pas de lui-même : on le copie dans public/,
// avec la version dans le nom (cache), avant chaque build et chaque lancement en développement.
// La carte l'indique à MapLibre avec setWorkerUrl (src/app/app/carte/map-view.tsx).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.startsWith("maplibre-gl-worker-")) rmSync(join(out, f));
copyFileSync(join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"), join(out, `maplibre-gl-worker-${version}.mjs`));
console.log(`Moteur de carte copié : public/vendor/maplibre-gl-worker-${version}.mjs`);
