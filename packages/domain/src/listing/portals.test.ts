import { describe, expect, it } from "vitest";
import { cleanListingUrl, listingParts, portalsToRemove, removalTaskTitle } from "./portals";

describe("diffusion sur les portails (D-066)", () => {
  const listings = [
    { portal: "seloger", status: "publie" },
    { portal: "leboncoin", status: "publie" },
    { portal: "bienici", status: "retire" },
  ] as const;
  it("bien vendu ou retiré : les annonces encore en ligne sont à retirer", () => {
    expect(portalsToRemove("vendu", listings)).toEqual(["seloger", "leboncoin"]);
    expect(portalsToRemove("retire", listings)).toEqual(["seloger", "leboncoin"]);
  });
  it("bien toujours à vendre (ou sous offre) : rien à retirer", () => {
    expect(portalsToRemove("mandat", listings)).toEqual([]);
    expect(portalsToRemove("sous_offre", listings)).toEqual([]);
    expect(portalsToRemove("vendu", [{ portal: "seloger", status: "retire" }])).toEqual([]);
  });
  it("titre de la tâche de retrait lisible et borné", () => {
    expect(removalTaskTitle(["seloger", "leboncoin"], "8 Boulevard du Port 80000 Amiens")).toBe(
      "Retirer l'annonce de SeLoger, Leboncoin : 8 Boulevard du Port 80000 Amiens",
    );
    expect(removalTaskTitle(["autre"], "x".repeat(300)).length).toBe(200);
  });
  it("lien d'annonce : https seulement, vide accepté, le reste refusé", () => {
    expect(cleanListingUrl(" https://www.exemple.fr/annonce/123 ")).toBe("https://www.exemple.fr/annonce/123");
    expect(cleanListingUrl("")).toBeNull();
    expect(cleanListingUrl("http://www.exemple.fr/a")).toBeUndefined();
    expect(cleanListingUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanListingUrl("https://exemple.fr/a b")).toBeUndefined();
    expect(cleanListingUrl(`https://exemple.fr/${"a".repeat(500)}`)).toBeUndefined();
  });
  it("titre et description séparés pour les champs des portails", () => {
    expect(listingParts("Maison 4 pièces – Amiens\n\nBelle maison.\n\nPrix : 250 000 €.")).toEqual({
      title: "Maison 4 pièces – Amiens", body: "Belle maison.\n\nPrix : 250 000 €.",
    });
    expect(listingParts("Seulement un titre")).toEqual({ title: "Seulement un titre", body: "" });
  });
});
