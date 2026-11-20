import { DEFAULT_WEIGHTS } from "@immopilot/domain";
import { describe, expect, it } from "vitest";
import { parseWeights } from "./weights";

describe("parseWeights", () => {
  it("garde les valeurs par défaut sans paramètre", () => {
    expect(parseWeights({})).toEqual({ weights: DEFAULT_WEIGHTS, custom: false });
  });

  it("lit les pondérations valides et ignore les autres", () => {
    const { weights, custom } = parseWeights({ p_budget: "50", p_surface: "abc", p_pieces: "250", p_localisation: ["10"] });
    expect(custom).toBe(true);
    expect(weights).toEqual({ ...DEFAULT_WEIGHTS, budget: 50 });
  });

  it("revient aux valeurs par défaut si tout est à zéro", () => {
    const zero = { p_budget: "0", p_localisation: "0", p_surface: "0", p_pieces: "0", p_equipements: "0" };
    expect(parseWeights(zero)).toEqual({ weights: DEFAULT_WEIGHTS, custom: false });
  });
});
