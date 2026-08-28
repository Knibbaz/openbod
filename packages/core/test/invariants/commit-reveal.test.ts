import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeCommitment, canonicalize, randomSalt } from "../../src/index.js";

describe("I2 bindende commitment: canonicalisatie en hash", () => {
  it("is deterministisch: gelijke payload en salt geven altijd dezelfde commitment", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.string(), (payload, salt) => {
        const a = computeCommitment(payload, salt);
        const b = computeCommitment(payload, salt);
        expect(a).toBe(b);
      }),
    );
  });

  it("sleutelvolgorde in objecten beinvloedt de hash niet", () => {
    const a = { amount: 100, motivation: "hallo" };
    const b = { motivation: "hallo", amount: 100 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("een andere salt geeft (vrijwel) altijd een andere commitment", () => {
    const payload = { amount: 100 };
    const c1 = computeCommitment(payload, randomSalt());
    const c2 = computeCommitment(payload, randomSalt());
    expect(c1).not.toBe(c2);
  });

  it("een gewijzigde payload met dezelfde salt geeft een andere commitment", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.string(), (a, b, salt) => {
        fc.pre(a !== b);
        expect(computeCommitment({ amount: a }, salt)).not.toBe(computeCommitment({ amount: b }, salt));
      }),
    );
  });
});
