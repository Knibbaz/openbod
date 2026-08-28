import { describe, it, expect } from "vitest";
import { OpenBodStore, sealBid, canonicalize } from "@openbod/core";
import { verifyLogbook, verifyReceipt } from "../src/verify.js";

function shortDeadline(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

describe("E8-S1: onafhankelijke verificatie", () => {
  it("een geldig logboek en ontvangstbewijs verifieren", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(4000);
    const listing = store.createListing({
      address: "Verifieerstraat 1",
      prijsVorm: "vraagprijs",
      verkoopmethode: "bieden_met_deadline",
      deadline,
      rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
      takeoverItems: [],
    });
    const sealed = await sealBid({ amount: 400000, conditions: [], takeover: [] }, deadline);
    const receipt = store.placeBid(listing.id, "sub-dave", sealed.commitment, sealed.ciphertext);

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    const logbook = await store.revealListing(listing.id);

    const logbookResult = verifyLogbook(logbook);
    expect(logbookResult.overallValid).toBe(true);

    const receiptResult = verifyReceipt(receipt, store.getLog(listing.id), store.keypair.publicKeyPem());
    expect(receiptResult.overallValid).toBe(true);
  }, 20000);

  it("een gemanipuleerd logboek faalt de verifier, met aanwijzing van de eerste kapotte regel", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(4000);
    const listing = store.createListing({
      address: "Vervalsstraat 2",
      prijsVorm: "richtprijs",
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: false },
      takeoverItems: [],
    });
    const sealed = await sealBid({ amount: 400000, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-erin", sealed.commitment, sealed.ciphertext);

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    const logbook = await store.revealListing(listing.id);

    // knoei met een middelste regel, zoals een instantie die achteraf zou herschrijven
    const tampered = { ...logbook, log: [...logbook.log] };
    tampered.log[1] = { ...tampered.log[1], payloadHash: "ingeknoeid" };

    const result = verifyLogbook(tampered);
    expect(result.hashchainValid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
    expect(result.overallValid).toBe(false);
  }, 20000);

  it("een receipt dat niet in het log voorkomt faalt de verificatie", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(60000);
    const listing = store.createListing({
      address: "Nietbestaandstraat 3",
      prijsVorm: "vraagprijs",
      verkoopmethode: "onderhandeling",
      deadline,
      rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: false },
      takeoverItems: [],
    });
    const forgedReceipt = {
      bidId: "nep",
      listingId: listing.id,
      commitment: "a".repeat(64),
      logIndex: 0,
      prevHash: "0".repeat(64),
      entryHash: "b".repeat(64),
      timestamp: new Date().toISOString(),
      instanceSignature: "vals",
    };
    const result = verifyReceipt(forgedReceipt, store.getLog(listing.id), store.keypair.publicKeyPem());
    expect(result.overallValid).toBe(false);
  });
});
