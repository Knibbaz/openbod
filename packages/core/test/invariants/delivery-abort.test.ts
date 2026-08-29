import { describe, it, expect } from "vitest";
import {
  OpenBodStore,
  HashChain,
  bidderRef,
  sealBid,
  InvalidTransitionError,
  RuleViolationError,
  type DeliveryRequest,
  type LogbookDelivery,
} from "../../src/index.js";

function shortDeadline(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

/** Bezorgkanaal dat onthoudt wat het kreeg, zodat de test kan controleren wat er echt uitging. */
class RecordingDelivery implements LogbookDelivery {
  readonly sent: DeliveryRequest[] = [];
  failNext = false;

  async deliver(request: DeliveryRequest): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("bezorging mislukt");
    }
    this.sent.push(request);
  }
}

function makeListing(store: OpenBodStore, deadline: string, sellerSub?: string) {
  return store.createListing({
    address: "Voorbeeldstraat 1, Amsterdam",
    prijsVorm: "vraagprijs",
    askingPrice: 500000,
    verkoopmethode: "inschrijving",
    deadline,
    rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
    takeoverItems: [],
    sellerSub,
  });
}

describe("E4-S3: automatische verstrekking van het biedlogboek", () => {
  it("stuurt na gunning vanzelf naar alle betrokkenen en legt de verzending vast", async () => {
    const delivery = new RecordingDelivery();
    const store = new OpenBodStore(delivery);
    const deadline = shortDeadline(3000);
    const listing = makeListing(store, deadline, "sub-verkoper");

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    const bidA = store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);
    const b = await sealBid({ amount: 495000, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-bob", b.commitment, b.ciphertext);

    await new Promise((r) => setTimeout(r, 4000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);
    store.awardListing(listing.id, bidA.bidId);

    // TC1: niemand hoeft erom te vragen, de verzending is een gevolg van de eindstatus
    const result = await store.deliverLogbook(listing.id);
    expect(delivery.sent).toHaveLength(1);
    expect(delivery.sent[0].recipients.sort()).toEqual(["sub-alice", "sub-bob", "sub-verkoper"]);

    // I14: de verzending staat zelf in de keten, met alleen pseudonieme refs
    const log = store.getLog(listing.id);
    const sentEntry = log.find((e) => e.type === "logboek_verstuurd");
    expect(sentEntry).toBeDefined();
    expect(result.logIndex).toBe(sentEntry!.index);
    expect(result.recipientRefs).toEqual(
      ["sub-alice", "sub-bob", "sub-verkoper"].map(bidderRef).sort(),
    );
    expect(HashChain.verify(log).valid).toBe(true);

    // I11: geen adres of ruwe sub in de logregel of in de vastgelegde ontvangers
    for (const ref of result.recipientRefs) {
      expect(ref).toMatch(/^bieder-[0-9a-f]{8}$/);
      expect(ref).not.toContain("sub-");
    }
  }, 30_000);

  it("is idempotent: herhaald aanroepen levert één logboek_verstuurd-regel op", async () => {
    const delivery = new RecordingDelivery();
    const store = new OpenBodStore(delivery);
    const deadline = shortDeadline(3000);
    const listing = makeListing(store, deadline);

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    const bidA = store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);

    await new Promise((r) => setTimeout(r, 4000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);
    store.awardListing(listing.id, bidA.bidId);

    // De scheduler roept dit herhaald en gelijktijdig aan
    const [first, second, third] = await Promise.all([
      store.deliverLogbook(listing.id),
      store.deliverLogbook(listing.id),
      store.deliverLogbook(listing.id),
    ]);
    await store.deliverLogbook(listing.id);

    expect(delivery.sent).toHaveLength(1);
    expect(second.logIndex).toBe(first.logIndex);
    expect(third.logIndex).toBe(first.logIndex);
    expect(store.getLog(listing.id).filter((e) => e.type === "logboek_verstuurd")).toHaveLength(1);
  }, 30_000);

  it("(beveiliging) claimt geen verzending die niet plaatsvond", async () => {
    const delivery = new RecordingDelivery();
    const store = new OpenBodStore(delivery);
    const deadline = shortDeadline(3000);
    const listing = makeListing(store, deadline);

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    const bidA = store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);

    await new Promise((r) => setTimeout(r, 4000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);
    store.awardListing(listing.id, bidA.bidId);

    delivery.failNext = true;
    await expect(store.deliverLogbook(listing.id)).rejects.toThrow();
    expect(store.getLog(listing.id).some((e) => e.type === "logboek_verstuurd")).toBe(false);
    expect(store.logbookDelivery(listing.id)).toBeUndefined();

    // en een nieuwe poging mag alsnog slagen
    await store.deliverLogbook(listing.id);
    expect(store.getLog(listing.id).filter((e) => e.type === "logboek_verstuurd")).toHaveLength(1);
  }, 30_000);

  it("(beveiliging) verstuurt niets zolang de procedure nog loopt", async () => {
    const delivery = new RecordingDelivery();
    const store = new OpenBodStore(delivery);
    const listing = makeListing(store, shortDeadline(60_000));

    await expect(store.deliverLogbook(listing.id)).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(delivery.sent).toHaveLength(0);
  });
});

describe("E7-S2: afhandeling buiten de procedure om", () => {
  it("legt een afgebroken inschrijving vast met reden en verstuurt het logboek", async () => {
    const delivery = new RecordingDelivery();
    const store = new OpenBodStore(delivery);
    const deadline = shortDeadline(60_000);
    const listing = makeListing(store, deadline);

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);

    const logbook = store.abortListing(listing.id, "Woning onderhands verkocht buiten de inschrijving om.");

    expect(store.getListing(listing.id).status).toBe("buiten_procedure");
    expect(logbook.listing.status).toBe("buiten_procedure");
    expect(logbook.listing.buitenProcedureReden).toContain("onderhands verkocht");

    const log = store.getLog(listing.id);
    expect(log.some((e) => e.type === "buiten_procedure_afgehandeld")).toBe(true);
    expect(HashChain.verify(log).valid).toBe(true);

    // De bieder krijgt het logboek, ook al is er nooit gegund
    await store.deliverLogbook(listing.id);
    expect(delivery.sent[0].recipients).toEqual(["sub-alice"]);
  }, 30_000);

  it("laat niet-onthulde biedingen verzegeld, maar bewijst wel dát ze er stonden", async () => {
    const store = new OpenBodStore(new RecordingDelivery());
    const deadline = shortDeadline(60_000);
    const listing = makeListing(store, deadline);

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);

    const logbook = store.abortListing(listing.id, "Verkoper heeft de woning van de markt gehaald.");

    // geen bedragen: de procedure waarvoor het bod bedoeld was gaat niet door
    expect(logbook.entries).toHaveLength(0);
    // maar het verzegelde bod is wel aantoonbaar geplaatst en nooit geopend
    expect(logbook.log.filter((e) => e.type === "bid_placed")).toHaveLength(1);
    expect(logbook.log.some((e) => e.type === "bid_revealed")).toBe(false);
  }, 30_000);

  it("(beveiliging) weigert een lege reden en weigert bieden na afbreken", async () => {
    const store = new OpenBodStore(new RecordingDelivery());
    const deadline = shortDeadline(60_000);
    const listing = makeListing(store, deadline);

    expect(() => store.abortListing(listing.id, "   ")).toThrow(RuleViolationError);
    expect(store.getListing(listing.id).status).toBe("biedfase");

    store.abortListing(listing.id, "Ingetrokken op verzoek van de verkoper.");
    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    expect(() => store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext)).toThrow(
      RuleViolationError,
    );
  }, 30_000);

  it("(beveiliging) kan een afgeronde gunning niet alsnog wegschrijven als buiten de procedure", async () => {
    const store = new OpenBodStore(new RecordingDelivery());
    const deadline = shortDeadline(3000);
    const listing = makeListing(store, deadline);

    const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
    const bidA = store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);

    await new Promise((r) => setTimeout(r, 4000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);
    store.awardListing(listing.id, bidA.bidId);

    expect(() => store.abortListing(listing.id, "toch maar niet")).toThrow(InvalidTransitionError);
    expect(store.getListing(listing.id).status).toBe("onherroepelijk");
  }, 30_000);
});
