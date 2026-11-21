import { describe, expect, it } from "vitest";
import { contactsWithoutValidConsent, duplicateGroups } from "./quality";

describe("qualité des données", () => {
  it("regroupe les doublons probables par e-mail, téléphone puis nom complet", () => {
    const groups = duplicateGroups([
      { id: "a", firstName: "Élodie", lastName: "Dupré", email: "Elodie@Test.invalid", phone: null },
      { id: "b", firstName: "E.", lastName: "Dupre", email: "elodie@test.invalid ", phone: null },
      { id: "c", firstName: "Paul", lastName: "Martin", email: null, phone: "+33 6 12 34 56 78" },
      { id: "d", firstName: "Pauline", lastName: "Martin", email: null, phone: "06 12 34 56 78" },
      { id: "e", firstName: "Zoé", lastName: "Bernard", email: null, phone: null },
      { id: "f", firstName: "Zoe", lastName: "BERNARD", email: null, phone: null },
      { id: "g", firstName: null, lastName: "Seul", email: null, phone: null },
      { id: "h", firstName: null, lastName: "Seul", email: null, phone: null }, // nom seul : pas assez pour conclure
    ]);
    expect(groups).toEqual([
      { reason: "email", ids: ["a", "b"] },
      { reason: "telephone", ids: ["c", "d"] },
      { reason: "nom", ids: ["e", "f"] },
    ]);
  });

  it("consentement : la dernière décision par canal fait foi, l'expiration compte", () => {
    const at = (d: string) => new Date(`${d}T10:00:00Z`);
    const missing = contactsWithoutValidConsent(
      ["ok", "retire", "expire", "aucun", "reaccorde"],
      [
        { contactId: "ok", channel: "email", status: "accorde", expiresAt: null, recordedAt: at("2026-01-01") },
        { contactId: "retire", channel: "email", status: "accorde", expiresAt: null, recordedAt: at("2026-01-01") },
        { contactId: "retire", channel: "email", status: "retire", expiresAt: null, recordedAt: at("2026-02-01") },
        { contactId: "expire", channel: "sms", status: "accorde", expiresAt: "2026-06-30", recordedAt: at("2026-01-01") },
        { contactId: "reaccorde", channel: "telephone", status: "retire", expiresAt: null, recordedAt: at("2026-01-01") },
        { contactId: "reaccorde", channel: "telephone", status: "accorde", expiresAt: null, recordedAt: at("2026-03-01") },
      ],
      "2026-11-21",
    );
    expect(missing).toEqual(["retire", "expire", "aucun"]);
  });
});
