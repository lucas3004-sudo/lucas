import { describe, expect, it } from "vitest";
import { agencySlug, canChangeRole, canInvite, canRemoveMember } from "./rules";

const base = { actorUserId: "a", targetUserId: "b", gerantCount: 1 };

describe("invitations", () => {
  it("le gérant peut inviter tous les rôles", () => {
    expect(canInvite("gerant", "gerant").ok).toBe(true);
    expect(canInvite("gerant", "negociateur").ok).toBe(true);
  });
  it("un manager ne peut pas inviter un gérant", () => {
    expect(canInvite("manager", "gerant").ok).toBe(false);
    expect(canInvite("manager", "negociateur").ok).toBe(true);
  });
  it("un négociateur, un assistant ou un lecteur ne peut pas inviter", () => {
    for (const role of ["negociateur", "assistant", "lecture"] as const) expect(canInvite(role, "lecture").ok).toBe(false);
  });
  it("un rôle inconnu ou combiné est refusé", () => {
    expect(canInvite("gerant", "owner").ok).toBe(false);
    expect(canInvite("gerant", "gerant,manager").ok).toBe(false);
  });
});

describe("changement de rôle", () => {
  it("un manager ne peut pas nommer un gérant", () => {
    expect(canChangeRole({ ...base, actor: "manager", targetRole: "negociateur", newRole: "gerant" }).ok).toBe(false);
  });
  it("un manager ne peut pas modifier un gérant", () => {
    expect(canChangeRole({ ...base, actor: "manager", targetRole: "gerant", newRole: "lecture", gerantCount: 2 }).ok).toBe(false);
  });
  it("l'agence garde toujours au moins un gérant", () => {
    expect(canChangeRole({ ...base, actor: "gerant", targetRole: "gerant", newRole: "manager", gerantCount: 1 }).ok).toBe(false);
    expect(canChangeRole({ ...base, actor: "gerant", targetRole: "gerant", newRole: "manager", gerantCount: 2 }).ok).toBe(true);
  });
  it("un manager peut promouvoir un négociateur manager (contrôle positif)", () => {
    expect(canChangeRole({ ...base, actor: "manager", targetRole: "negociateur", newRole: "manager" }).ok).toBe(true);
  });
  it("un manager ne modifie pas son propre rôle", () => {
    expect(canChangeRole({ ...base, actor: "manager", targetUserId: "a", targetRole: "manager", newRole: "lecture" }).ok).toBe(false);
  });
  it("un négociateur ne change aucun rôle", () => {
    expect(canChangeRole({ ...base, actor: "negociateur", targetRole: "lecture", newRole: "assistant" }).ok).toBe(false);
  });
});

describe("retrait d'un membre", () => {
  it("personne ne se retire soi-même par l'écran Équipe", () => {
    expect(canRemoveMember({ ...base, actor: "gerant", targetUserId: "a", targetRole: "gerant", gerantCount: 2 }).ok).toBe(false);
  });
  it("un manager ne retire pas un gérant", () => {
    expect(canRemoveMember({ ...base, actor: "manager", targetRole: "gerant", gerantCount: 2 }).ok).toBe(false);
  });
  it("le dernier gérant ne peut pas être retiré", () => {
    expect(canRemoveMember({ ...base, actor: "gerant", targetRole: "gerant", gerantCount: 1 }).ok).toBe(false);
  });
  it("un manager peut retirer un négociateur (contrôle positif)", () => {
    expect(canRemoveMember({ ...base, actor: "manager", targetRole: "negociateur" }).ok).toBe(true);
  });
});

describe("identifiant d'URL de l'agence", () => {
  it("simplifie le nom et ajoute le suffixe", () => {
    expect(agencySlug("Agence de l'Hôtel de Ville", "x7k2")).toBe("agence-de-l-hotel-de-ville-x7k2");
    expect(agencySlug("!!!", "x7k2")).toBe("agence-x7k2");
  });
});
