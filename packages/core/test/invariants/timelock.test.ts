import { describe, it, expect } from "vitest";
import { sealBid, decryptCiphertext } from "../../src/index.js";

/**
 * Integratietest tegen het echte publieke drand quicknet-netwerk (periode 3s).
 * Dit bewijst I1 en I4 end-to-end: geen partij kan vóór de deadline ontsleutelen,
 * en na de deadline kan iedereen het zonder actie van de bieder.
 */
describe("I1/I4 verzegeling en deadline-gestuurde onthulling (echte drand)", () => {
  it("ontsleutelen vóór de deadline mislukt, want de sleutel bestaat nog niet", async () => {
    const deadline = new Date(Date.now() + 30_000).toISOString();
    const { ciphertext } = await sealBid({ amount: 450000, conditions: [], takeover: [] }, deadline);
    await expect(decryptCiphertext(ciphertext)).rejects.toThrow(/te vroeg|too early/i);
  }, 20000);

  it("na de deadline kan iedereen ontsleutelen zonder actie van de bieder", async () => {
    const deadline = new Date(Date.now() + 4000).toISOString();
    const { ciphertext, commitment } = await sealBid(
      { amount: 450000, conditions: [{ type: "financieel", deadline: "2026-09-01" }], takeover: [] },
      deadline,
    );

    await new Promise((r) => setTimeout(r, 8000));

    const plaintext = await decryptCiphertext(ciphertext);
    const envelope = JSON.parse(plaintext.toString("utf8"));
    expect(envelope.payload.amount).toBe(450000);
    expect(typeof envelope.salt).toBe("string");
    expect(commitment).toHaveLength(64);
  }, 20000);
});
