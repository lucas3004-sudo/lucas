import { describe, expect, it } from "vitest";
import { recapHeadline, recapLines, type RecapCounts } from "./summary";

const zero: RecapCounts = {
  newProperties: 0, priceDrops: 0, underOffer: 0, sold: 0, newContacts: 0, newBuyerProfiles: 0, visitsDone: 0,
  strongInterest: 0, upcomingVisits: 0, newDeals: 0, deeds: 0, tasksDone: 0, tasksOverdue: 0, approvalsPending: 0, mandatesEndingSoon: 0,
};

describe("récap de l'activité", () => {
  it("rien sur la période : aucune ligne, une phrase claire", () => {
    expect(recapLines(zero)).toEqual([]);
    expect(recapHeadline(zero, "jour")).toBe("Depuis hier : rien de nouveau dans l'agence.");
  });

  it("singulier et pluriel, résultats d'abord, points d'attention à la fin", () => {
    const lines = recapLines({ ...zero, newProperties: 1, priceDrops: 2, underOffer: 1, tasksOverdue: 3 });
    expect(lines.map((l) => l.text)).toEqual(["1 bien passé sous offre", "1 nouveau bien", "2 baisses de prix", "3 tâches en retard"]);
    expect(lines.at(-1)?.tone).toBe("warning");
  });

  it("phrase d'accroche : les trois faits marquants, sans les alertes", () => {
    const c = { ...zero, sold: 1, newDeals: 2, newContacts: 4, newProperties: 3, tasksOverdue: 5 };
    expect(recapHeadline(c, "semaine")).toBe("Cette semaine : 1 bien vendu, 2 nouvelles offres ouvertes et 3 nouveaux biens.");
  });

  it("chaque ligne mène à la page où agir", () => {
    const lines = recapLines({ ...zero, approvalsPending: 1, mandatesEndingSoon: 2 });
    expect(lines).toEqual([
      { key: "approvalsPending", tone: "warning", text: "1 proposition d'agent attend votre accord", href: "/app/agents/approbations" },
      { key: "mandatesEndingSoon", tone: "warning", text: "2 mandats se terminent dans les 30 jours", href: "/app/proprietes" },
    ]);
  });
});
