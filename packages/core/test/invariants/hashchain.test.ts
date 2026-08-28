import { describe, it, expect } from "vitest";
import { HashChain } from "../../src/index.js";

describe("I3 onwrikbaar logboek: hashketen", () => {
  it("verify slaagt op een intacte keten", () => {
    const chain = new HashChain();
    chain.append("listing_opened", "hash1");
    chain.append("bid_placed", "hash2");
    chain.append("bid_placed", "hash3");
    const result = HashChain.verify(chain.all());
    expect(result.valid).toBe(true);
  });

  it("het wijzigen van één regel laat verify falen vanaf die regel", () => {
    const chain = new HashChain();
    chain.append("listing_opened", "hash1");
    chain.append("bid_placed", "hash2");
    chain.append("bid_placed", "hash3");
    const entries = chain.all();
    entries[1] = { ...entries[1], payloadHash: "geknoeid" };
    const result = HashChain.verify(entries);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
  });

  it("het verwijderen van een regel laat verify falen", () => {
    const chain = new HashChain();
    chain.append("listing_opened", "hash1");
    chain.append("bid_placed", "hash2");
    chain.append("bid_placed", "hash3");
    const entries = chain.all();
    entries.splice(1, 1);
    // na verwijdering klopt de index niet meer met de positie, dus prevHash mismatch
    const result = HashChain.verify(entries);
    expect(result.valid).toBe(false);
  });

  it("het invoegen van een regel breekt de keten", () => {
    const chain = new HashChain();
    chain.append("listing_opened", "hash1");
    chain.append("bid_placed", "hash3");
    const entries = chain.all();
    const forged = { ...entries[1], index: 1, payloadHash: "ingevoegd", entryHash: "vals" };
    entries.splice(1, 0, forged);
    const result = HashChain.verify(entries);
    expect(result.valid).toBe(false);
  });
});
