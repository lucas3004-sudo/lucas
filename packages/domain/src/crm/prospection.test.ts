import { describe, expect, it } from "vitest";
import {
  defaultFollowUpOn,
  followUpTitle,
  isProspectionStatus,
  ownerReach,
  PROSPECTION_LABELS,
  PROSPECTION_STATUSES,
  prospectionAfterPropertyStatus,
  prospectionCounts,
  prospectionEffects,
  sortProspects,
} from "./prospection";

describe("prospection", () => {
  it("sept statuts, dans l'ordre du parcours, avec leur libellé", () => {
    expect(PROSPECTION_STATUSES.map((s) => PROSPECTION_LABELS[s])).toEqual([
      "À contacter", "Contacté", "En attente", "Relance à effectuer", "Rendez-vous obtenu", "Mandat obtenu", "Sans suite",
    ]);
    expect(isProspectionStatus("relance")).toBe(true);
    expect(isProspectionStatus("gagne")).toBe(false);
    expect(isProspectionStatus(undefined)).toBe(false);
  });

  it("relance : tâche datée à 7 jours, titre borné ; mandat obtenu : le prospect passe sous mandat", () => {
    expect(defaultFollowUpOn("2026-11-26")).toBe("2026-12-03");
    expect(defaultFollowUpOn("2026-12-28")).toBe("2027-01-04");
    expect(followUpTitle("8 Boulevard du Port 80000 Amiens")).toBe("Relancer le propriétaire : 8 Boulevard du Port 80000 Amiens");
    expect(followUpTitle("x".repeat(300))).toHaveLength(200);
    expect(prospectionEffects("relance", "prospect")).toEqual({ followUp: true, toMandate: false });
    expect(prospectionEffects("mandat_obtenu", "prospect")).toEqual({ followUp: false, toMandate: true });
    // Déjà sous mandat, ou vendu : on ne revient pas en arrière.
    expect(prospectionEffects("mandat_obtenu", "vendu")).toEqual({ followUp: false, toMandate: false });
    expect(prospectionEffects("contacte", "prospect")).toEqual({ followUp: false, toMandate: false });
  });

  it("le statut du bien change : la prospection en cours suit, une prospection terminée ne bouge plus", () => {
    expect(prospectionAfterPropertyStatus("rendez_vous", "mandat")).toBe("mandat_obtenu");
    expect(prospectionAfterPropertyStatus("contacte", "retire")).toBe("sans_suite");
    expect(prospectionAfterPropertyStatus("contacte", "prospect")).toBe("contacte");
    expect(prospectionAfterPropertyStatus("sans_suite", "mandat")).toBe("sans_suite");
    expect(prospectionAfterPropertyStatus(null, "mandat")).toBeNull();
  });

  it("ordre : favoris, en cours avant terminés, relance la plus proche, puis le plus récent", () => {
    const at = (d: string) => new Date(`${d}T10:00:00Z`);
    const items = [
      { id: "termine", status: "sans_suite" as const, favorite: false, followUpOn: null, updatedAt: at("2026-11-25") },
      { id: "ancien", status: "contacte" as const, favorite: false, followUpOn: null, updatedAt: at("2026-11-01") },
      { id: "recent", status: "a_contacter" as const, favorite: false, followUpOn: null, updatedAt: at("2026-11-20") },
      { id: "relance", status: "relance" as const, favorite: false, followUpOn: "2026-11-28", updatedAt: at("2026-10-01") },
      { id: "favori", status: "en_attente" as const, favorite: true, followUpOn: null, updatedAt: at("2026-09-01") },
    ];
    expect(sortProspects(items).map((i) => i.id)).toEqual(["favori", "relance", "recent", "ancien", "termine"]);
  });

  it("compte par statut, et les biens encore en cours", () => {
    const c = prospectionCounts(["a_contacter", "a_contacter", "relance", "mandat_obtenu", "sans_suite"]);
    expect(c.total).toBe(5);
    expect(c.open).toBe(3);
    expect(c.byStatus).toMatchObject({ a_contacter: 2, relance: 1, mandat_obtenu: 1, sans_suite: 1, contacte: 0 });
  });

  it("joindre le propriétaire : appel ou e-mail seulement avec son accord enregistré, jamais sur un simple numéro", () => {
    const base = { hasOwner: true, phone: "06 12 34 56 78", email: "proprio@test.invalid", phoneConsent: false, emailConsent: false };
    expect(ownerReach({ ...base, hasOwner: false })).toMatchObject({ call: false, email: false, message: expect.stringContaining("pas encore enregistré") });
    expect(ownerReach(base)).toMatchObject({ call: false, email: false, message: expect.stringContaining("Aucun accord enregistré") });
    expect(ownerReach({ ...base, phoneConsent: true })).toEqual({ call: true, email: false, message: "Accord enregistré : vous pouvez le contacter par téléphone." });
    expect(ownerReach({ ...base, phoneConsent: true, emailConsent: true }).message).toBe("Accord enregistré : vous pouvez le contacter par téléphone et par e-mail.");
    // Accord sans le moyen correspondant : rien à proposer.
    expect(ownerReach({ ...base, email: null, emailConsent: true })).toMatchObject({ call: false, email: false });
  });
});
