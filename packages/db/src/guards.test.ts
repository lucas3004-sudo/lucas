/**
 * Garde-fous statiques (décision D-016) : le contexte d'agence ne doit JAMAIS être fixé au
 * niveau de la session. Le prototype (test T11) a montré qu'un réglage de session fuit dans
 * les requêtes suivantes d'une connexion réutilisée.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED = ["apps", "packages"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);
const EXTENSIONS = /\.(ts|tsx|sql|mjs|js)$/;

async function* files(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

const FORBIDDEN = [
  { name: "set_config en mode session", pattern: /set_config\(\s*'app\.[a-z_]+'\s*,[^)]*,\s*false\s*\)/i },
  { name: "SET app.* sans LOCAL", pattern: /\bSET\s+(SESSION\s+)?"?app\.[a-z_]+/i },
];

describe("garde-fous du contexte d'agence", () => {
  it("aucun fichier ne fixe le contexte au niveau de la session", async () => {
    const offenders: string[] = [];
    for (const root of SCANNED) {
      for await (const file of files(join(REPO, root))) {
        if (file.endsWith("guards.test.ts")) continue;
        const content = await readFile(file, "utf8");
        for (const rule of FORBIDDEN) {
          if (rule.pattern.test(content)) offenders.push(`${relative(REPO, file)} : ${rule.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("les motifs interdits sont bien détectés (contrôle positif)", () => {
    expect(FORBIDDEN[0]!.pattern.test("SELECT set_config('app.org_id', $1, false)")).toBe(true);
    expect(FORBIDDEN[1]!.pattern.test("SET app.org_id = 'x'")).toBe(true);
    expect(FORBIDDEN[0]!.pattern.test("SELECT set_config('app.org_id', $1, true)")).toBe(false);
  });
});
