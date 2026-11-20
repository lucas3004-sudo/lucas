import { afterEach, describe, expect, it } from "vitest";
import { limitFromEnv } from "./options";

describe("limitFromEnv", () => {
  afterEach(() => {
    delete process.env.TEST_LIMIT;
  });

  it("garde la valeur de production sans variable", () => {
    expect(limitFromEnv("TEST_LIMIT", 5)).toBe(5);
  });

  it("accepte un entier entre 1 et 1000", () => {
    process.env.TEST_LIMIT = "50";
    expect(limitFromEnv("TEST_LIMIT", 5)).toBe(50);
  });

  it("ignore une valeur invalide ou hors bornes", () => {
    for (const bad of ["0", "-3", "abc", "5000", "12.5", ""]) {
      process.env.TEST_LIMIT = bad;
      expect(limitFromEnv("TEST_LIMIT", 5), bad).toBe(5);
    }
  });
});
