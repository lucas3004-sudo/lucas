import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./client";

describe("messages d'erreur de l'authentification", () => {
  it("message clair pour les cas connus, code affiché sinon (diagnostic à distance)", () => {
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS" })).toBe("Un compte existe déjà avec cette adresse e-mail.");
    expect(authErrorMessage({ status: 429 })).toBe("Trop de tentatives. Patientez une minute avant de réessayer.");
    expect(authErrorMessage({ code: "QUELQUE_CHOSE" })).toBe("Une erreur est survenue. Réessayez. (code : QUELQUE_CHOSE)");
    expect(authErrorMessage({ status: 403 })).toBe("Une erreur est survenue. Réessayez. (code : HTTP 403)");
  });
});
