/**
 * Tests des adaptateurs sur des EXTRAITS DE RÉPONSES RÉELLES relevées le 2026-11-20
 * (adresse témoin : 8 boulevard du Port, 80000 Amiens), sans appel réseau.
 */
import { describe, expect, it, vi } from "vitest";
import { departmentOf, geocode } from "./ban";
import { toDpeRecord } from "./dpe";
import { request, SourceError } from "./http";
import { parseRentsCsv } from "./rents";
import { parseInForceDate, parseZonageCsv } from "./zonage";
import { toRiskReport } from "./georisques";

const noSleep = async () => {};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("HTTP avec nouvelles tentatives", () => {
  it("réessaie après une coupure réseau puis réussit (cas constaté sur Géorisques)", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json({ ok: true }));
    const res = await request("https://x", { source: "test", fetcher, sleep: noSleep });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("réessaie sur 503 et 429, mais pas sur 404", async () => {
    const retrying = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(json({}));
    await request("https://x", { source: "test", fetcher: retrying, sleep: noSleep });
    expect(retrying).toHaveBeenCalledTimes(3);
    const notFound = vi.fn().mockResolvedValue(json({}, 404));
    await expect(request("https://x", { source: "test", fetcher: notFound, sleep: noSleep })).rejects.toBeInstanceOf(SourceError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("abandonne après le nombre de tentatives prévu, avec un message clair", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(request("https://x", { source: "Géorisques", retries: 2, fetcher, sleep: noSleep })).rejects.toThrow(/Géorisques : indisponible après 3 tentatives/);
  });
});

describe("BAN", () => {
  it("transforme la réponse réelle de la Géoplateforme", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({
      features: [{
        geometry: { coordinates: [2.290084, 49.897442] },
        properties: { label: "8 Boulevard du Port 80000 Amiens", score: 0.5965941258741259, id: "80021_6590_00008", postcode: "80000", citycode: "80021", city: "Amiens", type: "housenumber" },
      }],
    }));
    const [address] = await geocode("8 bd du port amiens", { fetcher });
    expect(address).toMatchObject({ banId: "80021_6590_00008", inseeCode: "80021", department: "80", longitude: 2.290084, latitude: 49.897442 });
  });
  it("ne cherche pas en dessous de 3 caractères", async () => {
    const fetcher = vi.fn();
    expect(await geocode("ab", { fetcher })).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("départements, y compris Corse et outre-mer", () => {
    expect(departmentOf("80021")).toBe("80");
    expect(departmentOf("2A004")).toBe("2A");
    expect(departmentOf("97411")).toBe("974");
  });
});

describe("DPE", () => {
  it("transforme un DPE réel d'Amiens (gaz, 2026 : pas d'alerte électricité)", () => {
    const dpe = toDpeRecord({
      numero_dpe: "2680E0051534J", date_etablissement_dpe: "2026-01-06", etiquette_dpe: "D", etiquette_ges: "D",
      type_energie_principale_chauffage: "Gaz naturel", cout_total_5_usages: 1447,
    }, "2026-11-20");
    expect(dpe).toMatchObject({ energyClass: "D", annualCost: 1447, electricityCoefficientChange: false, expired: false });
  });
  it("signale un DPE électrique antérieur à 2026 (coefficient passé de 2,3 à 1,9)", () => {
    expect(toDpeRecord({ date_etablissement_dpe: "2024-05-02", type_energie_principale_chauffage: "Électricité" }).electricityCoefficientChange).toBe(true);
  });
  it("signale un DPE expiré", () => {
    expect(toDpeRecord({ date_etablissement_dpe: "2015-01-01", date_fin_validite_dpe: "2024-12-31" }, "2026-11-20").expired).toBe(true);
  });
});

describe("Géorisques", () => {
  it("garde les risques présents, avec les statuts commune ET adresse (réponse réelle, Amiens)", () => {
    const report = toRiskReport({
      url: "https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi/rapport2?…",
      risquesNaturels: {
        inondation: { present: true, libelleStatutCommune: "Risque Existant", libelleStatutAdresse: "Risque non Connu" },
        risqueCotier: { present: false, libelleStatutCommune: null, libelleStatutAdresse: null },
        radon: { present: true, libelleStatutCommune: "Risque Existant - faible", libelleStatutAdresse: "Risque Existant - faible" },
      },
      risquesTechnologiques: {
        pollutionSols: { present: true, libelleStatutCommune: "Risque Concerne", libelleStatutAdresse: "Risque Concerne" },
        nucleaire: { present: false },
      },
    });
    expect(report.risks.map((r) => r.key)).toEqual(["inondation", "radon", "pollutionSols"]);
    expect(report.risks[0]).toMatchObject({ label: "Inondation", commune: "Risque Existant", address: "Risque non Connu", kind: "naturel" });
    expect(report.officialReportUrl).toContain("georisques.gouv.fr");
  });
});

describe("loyers ANIL", () => {
  it("lit le format réel (point-virgule, décimales à virgule, guillemets)", () => {
    const csv = [
      '"id_zone";"INSEE_C";"LIBGEO";"EPCI";"DEP";"REG";"loypredm2";"lwr.IPm2";"upr.IPm2";"TYPPRED";"nbobs_com";"nbobs_mail";"R2_adj"',
      '"850";"80021";"Amiens";"248000531";"80";"32";13,4015661488363;11,0011293751912;16,3257761195554;"commune";41032;41173;0,85273697655919',
    ].join("\r\n");
    expect(parseRentsCsv(csv, "appartement")).toEqual([{
      inseeCode: "80021", segment: "appartement", rentPerSqm: 13.4015661488363, low: 11.0011293751912, high: 16.3257761195554,
      prediction: "commune", obsCommune: 41032, obsMaille: 41173, r2Adj: 0.85273697655919,
    }]);
  });
});

describe("zonage ABC", () => {
  it("lit le format réel et la date d'entrée en vigueur dans l'en-tête", () => {
    const { rows, inForceFrom } = parseZonageCsv("﻿CODGEO;DEP;LIBGEO;Zonage ABC en vigueur depuis le 26 juin 2026\n80021;80;Amiens;B1\n");
    expect(inForceFrom).toBe("2026-06-26");
    expect(rows).toEqual([{ inseeCode: "80021", commune: "Amiens", zone: "B1" }]);
  });
  it("refuse un format inattendu", () => {
    expect(() => parseZonageCsv("X;Y\n1;2\n")).toThrow(/format inattendu/);
  });
  it("dates en lettres", () => {
    expect(parseInForceDate("en vigueur depuis le 5 septembre 2025")).toBe("2025-09-05");
  });
});
