import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqlitePersistence } from "../../src/persistence/sqlite.js";
import {
  OpenBodStore,
  InstanceKeypair,
  HashChain,
  ChainCorruptError,
  sealBid,
  verifyWithPublicKeyPem,
  canonicalize,
  type BidReceipt,
} from "../../src/index.js";

/**
 * Wat een herstart mag doen: niets.
 *
 * De hashketen en de ontvangstbewijzen beschermen tegen een instantie die
 * valsspeelt. Ze beschermen niet tegen een instantie die haar geheugen
 * kwijtraakt, en voor een verkoper die zijn inschrijving kwijt is maakt dat
 * verschil weinig uit. Deze tests gaan over dat tweede geval.
 */

let dir: string;
let path: string;

// Steeds hetzelfde sleutelpaar meegeven: een instantie die na een herstart met
// een nieuwe sleutel tekent, maakt elk eerder uitgegeven ontvangstbewijs
// onverifieerbaar. Dat is wat CORE_SIGNING_KEY in een deployment doet.
function nieuweStore(keypair: InstanceKeypair) {
  return new OpenBodStore(undefined, keypair, new SqlitePersistence(path));
}

function overSeconden(s: number) {
  return new Date(Date.now() + s * 1000).toISOString();
}

const WONING = (deadline: string) => ({
  address: "Voorbeeldstraat 1, Amsterdam",
  prijsVorm: "vraagprijs" as const,
  askingPrice: 500000,
  verkoopmethode: "bieden_met_deadline" as const,
  deadline,
  rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
  takeoverItems: [{ label: "Gordijnen woonkamer", status: "in_overleg" as const }],
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "openbod-test-"));
  path = join(dir, "openbod.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Persistentie: een herstart wist geen biedingen", () => {
  it("woningen, biedingen en de hashketen staan er na een herstart nog precies zo", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(3600);

    let listingId: string;
    let receipt: BidReceipt;
    let ketenVoor: ReturnType<OpenBodStore["getLog"]>;
    {
      const store = nieuweStore(keypair);
      const listing = store.createListing(WONING(deadline));
      listingId = listing.id;
      const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
      receipt = store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);
      const b = await sealBid({ amount: 495000, conditions: [], takeover: [] }, deadline);
      store.placeBid(listing.id, "sub-bob", b.commitment, b.ciphertext);
      ketenVoor = store.getLog(listing.id);
    }

    // De instantie gaat uit en komt terug: nieuw proces, zelfde bestand.
    const herstart = nieuweStore(keypair);

    expect(herstart.allListings()).toHaveLength(1);
    expect(herstart.getListing(listingId).address).toBe("Voorbeeldstraat 1, Amsterdam");
    expect(herstart.getListing(listingId).status).toBe("biedfase");
    expect(herstart.bidCount(listingId)).toBe(2);
    expect(herstart.getLog(listingId)).toEqual(ketenVoor);
    expect(HashChain.verify(herstart.getLog(listingId)).valid).toBe(true);
    expect(herstart.activeBidFor(listingId, "sub-alice")?.commitment).toBe(receipt.commitment);
  });

  it("een ontvangstbewijs van voor de herstart verifieert er daarna nog steeds", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(3600);

    let listingId: string;
    let receipt: BidReceipt;
    {
      const store = nieuweStore(keypair);
      const listing = store.createListing(WONING(deadline));
      listingId = listing.id;
      const sealed = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
      receipt = store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext);
    }

    const herstart = nieuweStore(keypair);
    const regel = herstart.getLog(listingId)[receipt.logIndex];

    // Dit is de test die er echt toe doet. Zou de instantie haar keten bij het
    // opstarten herberekenen in plaats van teruglezen, dan kreeg deze regel een
    // nieuwe timestamp en dus een nieuwe hash, en hield de bieder een bewijs
    // vast dat nergens meer op slaat.
    expect(regel.entryHash).toBe(receipt.entryHash);
    expect(regel.prevHash).toBe(receipt.prevHash);
    expect(regel.timestamp).toBe(receipt.timestamp);

    const { instanceSignature, ...ondertekend } = receipt;
    expect(
      verifyWithPublicKeyPem(canonicalize(ondertekend), instanceSignature, herstart.keypair.publicKeyPem()),
    ).toBe(true);
  });

  it("het bod staat op disk voordat de bieder zijn ontvangstbewijs krijgt", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(3600);
    const store = nieuweStore(keypair);
    const listing = store.createListing(WONING(deadline));
    const sealed = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);

    const receipt = store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext);

    // Meelezen vanuit een tweede verbinding: wat hier zichtbaar is, is
    // gecommit. Zou de schrijf pas ná het ontvangstbewijs komen, dan was dit
    // leeg en hield de bieder een bewijs voor een bod dat na een stroomstoring
    // niet meer bestond.
    const lezer = new DatabaseSync(path, { readOnly: true });
    try {
      const rij = lezer
        .prepare("SELECT entry_hash FROM log_entries WHERE listing_id = ? AND idx = ?")
        .get(listing.id, receipt.logIndex) as { entry_hash: string } | undefined;
      expect(rij?.entry_hash).toBe(receipt.entryHash);
      const bod = lezer.prepare("SELECT COUNT(*) n FROM sealed_bids WHERE listing_id = ?").get(listing.id) as {
        n: number;
      };
      expect(bod.n).toBe(1);
    } finally {
      lezer.close();
    }
  });

  it("de database weigert een tweede logregel op dezelfde index", () => {
    const keypair = new InstanceKeypair();
    const store = nieuweStore(keypair);
    const listing = store.createListing(WONING(overSeconden(3600)));
    const entry = store.getLog(listing.id)[0];

    const db = new DatabaseSync(path);
    try {
      expect(() =>
        db
          .prepare(
            "INSERT INTO log_entries (listing_id, idx, timestamp, type, payload_hash, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(listing.id, entry.index, entry.timestamp, entry.type, entry.payloadHash, entry.prevHash, entry.entryHash),
      ).toThrow();
    } finally {
      db.close();
    }
  });

  it("een gewijzigde logregel laat de instantie weigeren op te starten", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(3600);
    let listingId: string;
    {
      const store = nieuweStore(keypair);
      const listing = store.createListing(WONING(deadline));
      listingId = listing.id;
      const sealed = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
      store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext);
    }

    const db = new DatabaseSync(path);
    db.prepare("UPDATE log_entries SET payload_hash = ? WHERE listing_id = ? AND idx = 1").run("00", listingId);
    db.close();

    // Verder draaien op een beschadigde keten zou betekenen dat de instantie
    // blijft tekenen op iets wat niet meer klopt.
    expect(() => nieuweStore(keypair)).toThrow(ChainCorruptError);
  });

  it("een volledige procedure overleeft een herstart, tot en met logboek en verstrekking", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(4);
    let listingId: string;
    {
      const store = nieuweStore(keypair);
      const listing = store.createListing({ ...WONING(deadline), sellerSub: "sub-verkoper" });
      listingId = listing.id;
      const a = await sealBid({ amount: 510000, conditions: [], takeover: [] }, deadline);
      store.placeBid(listing.id, "sub-alice", a.commitment, a.ciphertext);
      const b = await sealBid({ amount: 495000, conditions: [], takeover: [] }, deadline);
      store.placeBid(listing.id, "sub-bob", b.commitment, b.ciphertext);

      await new Promise((r) => setTimeout(r, 5000));
      store.closeListing(listing.id);
      await store.revealListing(listing.id);
      const beste = [...store.getRevealed(listing.id)].filter((x) => x.valid).sort((x, y) => y.amount - x.amount)[0];
      store.awardListing(listing.id, beste.bidId);
      await store.deliverLogbook(listing.id);
    }

    const herstart = nieuweStore(keypair);
    const listing = herstart.getListing(listingId);
    expect(listing.status).toBe("onherroepelijk");
    expect(listing.awardedBidId).toBeDefined();

    const logboek = herstart.getLogbook(listingId);
    expect(logboek.entries).toHaveLength(2);
    expect(logboek.entries.map((e) => e.amount).sort()).toEqual([495000, 510000]);
    expect(HashChain.verify(herstart.getLog(listingId)).valid).toBe(true);
    // Het logboek is bij de gunning gegenereerd; de verzendregel komt er daarna
    // pas achter. De root hoort dus bij de laatste regel van vóór de verzending.
    const keten = herstart.getLog(listingId);
    expect(logboek.rootHash).toBe(keten.filter((e) => e.type !== "logboek_verstuurd").at(-1)?.entryHash);

    // De verstrekking is al gebeurd en mag niet nog eens gebeuren: anders komt
    // er na elke herstart een tweede logboek_verstuurd in de keten te staan.
    const verstrekking = herstart.logbookDelivery(listingId);
    expect(verstrekking?.recipientRefs).toHaveLength(3);
    expect(herstart.getLog(listingId).filter((e) => e.type === "logboek_verstuurd")).toHaveLength(1);
  }, 30_000);

  it("bedragen staan als hele centen in de database, zodat er exact mee te rekenen valt", async () => {
    const keypair = new InstanceKeypair();
    const deadline = overSeconden(4);
    const store = nieuweStore(keypair);
    const listing = store.createListing(WONING(deadline));
    const sealed = await sealBid({ amount: 510000.5, conditions: [], takeover: [] }, deadline);
    store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext);

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);

    const lezer = new DatabaseSync(path, { readOnly: true });
    try {
      const rij = lezer.prepare("SELECT amount_cents FROM revealed_bids WHERE listing_id = ?").get(listing.id) as {
        amount_cents: number;
      };
      expect(rij.amount_cents).toBe(51000050);
      expect(Number.isInteger(rij.amount_cents)).toBe(true);
    } finally {
      lezer.close();
    }

    // En het bedrag zelf staat onveranderd in het logboek, want daar verifieert
    // de commitment overheen.
    expect(store.getLogbook(listing.id).entries[0].amount).toBe(510000.5);
  }, 30_000);
});
