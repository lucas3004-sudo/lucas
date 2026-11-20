/**
 * Test de référence sur un VRAI fichier DVF (non versionné : données publiques soumises à
 * conditions de réutilisation, D-007). Lancé seulement si DVF_GOLDEN_FILE est défini :
 *   DVF_GOLDEN_FILE=/chemin/80021.csv pnpm --filter @immopilot/domain test
 * Valeurs attendues = résultats du prototype Python (docs/phase-2/ingestion.md, section 3)
 * sur le fichier DVF 2025 d'Amiens (INSEE 80021).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { csvRecords } from "../csv";
import { summarize } from "../stats";
import { cleanDvf, type DvfLine } from "./clean";

const file = process.env.DVF_GOLDEN_FILE;

describe.skipIf(!file)("référence : DVF Amiens 2025, identique au prototype", () => {
  it("mêmes effectifs, exclusions et médianes", () => {
    const lines = csvRecords<DvfLine & Record<string, string>>(readFileSync(file!, "utf8"));
    const report = cleanDvf(lines);
    expect(report.lines).toBe(5439);
    expect(report.mutations).toBe(2305);
    expect(report.exclusions).toEqual({ R1: 12, R3: 624, R4: 2, R5: 4 });

    const group = (type: string, nature: string) =>
      report.sales.filter((s) => s.type === type && s.nature === nature).map((s) => s.pricePerSqm);
    const flats = summarize(group("Appartement", "ancien"));
    expect(flats.count).toBe(767);
    expect(Math.round(flats.median)).toBe(2470);
    expect(Math.round(flats.q1)).toBe(1893);
    expect(Math.round(flats.q3)).toBe(2957);
    const houses = summarize(group("Maison", "ancien"));
    expect(houses.count).toBe(877);
    expect(Math.round(houses.median)).toBe(2265);
    expect(summarize(group("Appartement", "neuf")).count).toBe(17);
  });
});
