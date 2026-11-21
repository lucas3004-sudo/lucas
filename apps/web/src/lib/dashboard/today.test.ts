import { describe, expect, it } from "vitest";
import type { Task } from "../crm/data";
import { bucketTasks, nextDay, todayAndTomorrowWindow } from "./today";

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36), assignee_user_id: "me", created_by: "me", title: "Relance", details: null,
  due_on: null, status: "a_faire", contact_id: null, property_id: null, created_at: new Date(), ...over,
});

describe("Ma journée", () => {
  it("jour suivant, y compris en fin de mois et d'année", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31", 2)).toBe("2027-01-02");
  });

  it("fenêtre aujourd'hui + demain à Paris, en UTC (hiver : UTC+1)", () => {
    const w = todayAndTomorrowWindow("2026-11-21");
    expect(w.from.toISOString()).toBe("2026-11-20T23:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-11-22T23:00:00.000Z");
  });

  it("répartit les tâches ouvertes : en retard, du jour, signalements de biens", () => {
    const b = bucketTasks(
      [
        task({ title: "A", due_on: "2026-11-20" }),
        task({ title: "B", due_on: "2026-11-21" }),
        task({ title: "C", due_on: "2026-11-25" }),
        task({ title: "D", due_on: "2026-11-19", status: "faite" }),
        task({ title: "Bien correspondant à vos acquéreurs (100 %)" }),
      ],
      "2026-11-21",
    );
    expect(b.overdue.map((t) => t.title)).toEqual(["A"]);
    expect(b.today.map((t) => t.title)).toEqual(["B"]);
    expect(b.matches.map((t) => t.title)).toEqual(["Bien correspondant à vos acquéreurs (100 %)"]);
  });
});
