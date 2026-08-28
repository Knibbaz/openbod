import { describe, it, expect } from "vitest";
import { OpenBodStore, sealBid, HashChain } from "../../src/index.js";

function shortDeadline(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

describe("End-to-end biedflow (E2, E3, E4, E7, E8)", () => {
  it("plaatsen, sluiten, onthullen, en het logboek klopt en verifieert", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(4000);

    const listing = store.createListing({
      address: "Voorbeeldstraat 1, Amsterdam",
      prijsVorm: "vraagprijs",
      askingPrice: 500000,
      verkoopmethode: "bieden_met_deadline",
      deadline,
      rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
      takeoverItems: [{ label: "Gordijnen woonkamer", status: "in_overleg" }],
    });
    expect(listing.status).toBe("biedfase");

    const sealedA = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    const receiptA = store.placeBid(listing.id, "sub-alice", sealedA.commitment, sealedA.ciphertext);
    expect(receiptA.logIndex).toBe(1); // 0 = listing_opened

    const sealedB = await sealBid({ amount: 495000, conditions: [{ type: "financieel" }], takeover: [] }, deadline);
    const receiptB = store.placeBid(listing.id, "sub-bob", sealedB.commitment, sealedB.ciphertext);

    // I7: het ontvangstbewijs verifieert tegen de op dat moment laatste logregel
    const log = store.getLog(listing.id);
    expect(log[receiptA.logIndex].entryHash).toBe(receiptA.entryHash);
    expect(log[receiptB.logIndex].entryHash).toBe(receiptB.entryHash);

    // E6-S2: alleen het aantal is zichtbaar
    expect(store.bidCount(listing.id)).toBe(2);

    // wachten tot na de deadline, dan sluiten en onthullen
    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    const logbook = await store.revealListing(listing.id);

    expect(logbook.entries).toHaveLength(2);
    const amounts = logbook.entries.map((e) => e.amount).sort();
    expect(amounts).toEqual([495000, 510000]);
    expect(logbook.entries.every((e) => e.valid)).toBe(true);

    // I3/I8: de hashketen verifieert en de root klopt met de laatste entry
    const verifyResult = HashChain.verify(logbook.log);
    expect(verifyResult.valid).toBe(true);
    expect(logbook.rootHash).toBe(logbook.log[logbook.log.length - 1].entryHash);

    // logboek-handtekening verifieert met de gepubliceerde publieke sleutel
    const { canonicalize } = await import("../../src/index.js");
    const { signature, signerPublicKey, ...unsigned } = logbook;
    expect(store.keypair.verify(canonicalize(unsigned), signature)).toBe(true);

    // I11: geen motivatie en geen herleidbare identiteit in het openbare logboek
    for (const entry of logbook.entries) {
      expect(entry).not.toHaveProperty("motivation");
      expect(entry).not.toHaveProperty("bidderSub");
    }
  }, 20000);

  it("een gemanipuleerde ciphertext faalt de onthullingsvalidatie en wordt ongeldig gemarkeerd (I2)", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(4000);
    const listing = store.createListing({
      address: "Nepstraat 2",
      prijsVorm: "richtprijs",
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: false },
      takeoverItems: [],
    });
    const sealed = await sealBid({ amount: 300000, conditions: [], takeover: [] }, deadline);
    // knoei met de commitment zodat plaintext niet meer matcht na onthulling
    const receipt = store.placeBid(listing.id, "sub-eve", "0".repeat(64), sealed.ciphertext);
    expect(receipt.commitment).toBe("0".repeat(64));

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    const logbook = await store.revealListing(listing.id);

    expect(logbook.entries[0].valid).toBe(false);
    expect(logbook.entries[0].invalidReason).toMatch(/commitment/);
  }, 20000);

  it("één lopend bod per bieder; aanpassen en opnieuw bieden na intrekken mag wel", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(60000);
    const listing = store.createListing({
      address: "Dubbelstraat 2",
      prijsVorm: "vraagprijs",
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
      takeoverItems: [],
    });
    const first = await sealBid({ amount: 400000, conditions: [], takeover: [] }, deadline);
    const receipt = store.placeBid(listing.id, "sub-eve", first.commitment, first.ciphertext);

    const second = await sealBid({ amount: 410000, conditions: [], takeover: [] }, deadline);
    expect(() => store.placeBid(listing.id, "sub-eve", second.commitment, second.ciphertext)).toThrowError(
      /al een lopend bod/,
    );
    expect(store.bidCount(listing.id)).toBe(1);

    // aanpassen mag; het ontvangstbewijs wijst dan naar de nieuwe logregel
    const adjusted = store.adjustBid(listing.id, receipt.bidId, "sub-eve", second.commitment, second.ciphertext);
    expect(adjusted.logIndex).toBeGreaterThan(receipt.logIndex);
    expect(store.receiptForBidder(listing.id, "sub-eve")?.entryHash).toBe(adjusted.entryHash);

    // na intrekken is het veld weer vrij voor deze bieder
    store.withdrawBid(listing.id, receipt.bidId, "sub-eve");
    expect(store.receiptForBidder(listing.id, "sub-eve")).toBeUndefined();
    const third = await sealBid({ amount: 420000, conditions: [], takeover: [] }, deadline);
    expect(() => store.placeBid(listing.id, "sub-eve", third.commitment, third.ciphertext)).not.toThrow();

    // een andere bieder wordt hier niet door geraakt
    const other = await sealBid({ amount: 430000, conditions: [], takeover: [] }, deadline);
    expect(() => store.placeBid(listing.id, "sub-frank", other.commitment, other.ciphertext)).not.toThrow();
    expect(store.bidCount(listing.id)).toBe(2);
  }, 20000);

  it("gelijktijdig onthullen levert geen dubbele bid_revealed-regels op", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(4000);
    const listing = store.createListing({
      address: "Racestraat 5",
      prijsVorm: "vraagprijs",
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: true },
      takeoverItems: [],
    });
    const sealed = await sealBid({ amount: 400000, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-dave", sealed.commitment, sealed.ciphertext);

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);

    // De scheduler in de API roept elke 2s aan; onthullen duurt langer dan dat.
    // Beide aanroepen horen dezelfde onthulling te delen, niet er twee te doen.
    const [first, second] = await Promise.all([
      store.revealListing(listing.id),
      store.revealListing(listing.id),
    ]);

    expect(first.rootHash).toBe(second.rootHash);
    const reveals = first.log.filter((e) => e.type === "bid_revealed");
    expect(reveals).toHaveLength(1);
    expect(first.entries).toHaveLength(1);
    expect(HashChain.verify(first.log).valid).toBe(true);
  }, 20000);

  it("intrekken zonder toestemming wordt geweigerd (E6-S1)", async () => {
    const store = new OpenBodStore();
    const deadline = shortDeadline(60000);
    const listing = store.createListing({
      address: "Weigerstraat 3",
      prijsVorm: "vraagprijs",
      verkoopmethode: "onderhandeling",
      deadline,
      rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: false },
      takeoverItems: [],
    });
    const sealed = await sealBid({ amount: 250000, conditions: [], takeover: [] }, deadline);
    const receipt = store.placeBid(listing.id, "sub-carol", sealed.commitment, sealed.ciphertext);
    expect(() => store.withdrawBid(listing.id, receipt.bidId, "sub-carol")).toThrowError(/niet toegestaan/);
  });
});
