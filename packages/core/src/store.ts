import { randomUUID } from "node:crypto";
import { HashChain } from "./log/hashchain.js";
import { InstanceKeypair } from "./log/signing.js";
import { revealBid } from "./reveal/reveal.js";
import { generatePublicLogbook, type Logbook } from "./logbook/logbook.js";
import { sha256Hex } from "./commit/hash.js";
import { canonicalize } from "./commit/canonical.js";
import type {
  BidReceipt,
  Listing,
  ListingRules,
  OvernameItem,
  PrijsVorm,
  RevealedBid,
  SealedBid,
  Verkoopmethode,
} from "./model/types.js";

export interface CreateListingInput {
  address: string;
  prijsVorm: PrijsVorm;
  askingPrice?: number;
  verkoopmethode: Verkoopmethode;
  deadline: string;
  rules: ListingRules;
  takeoverItems: Omit<OvernameItem, "itemId">[];
}

export class ListingNotFoundError extends Error {}
export class InvalidTransitionError extends Error {}
export class RuleViolationError extends Error {}

interface ListingRecord {
  listing: Listing;
  chain: HashChain;
  bids: Map<string, SealedBid>;
  revealed?: RevealedBid[];
  logbook?: Logbook;
  /** Zie `revealListing`: houdt een lopende onthulling vast tegen dubbele logregels. */
  revealing?: Promise<Logbook>;
}

/**
 * In-memory referentie-implementatie van de core-orchestratie. Voor de MVP-demo;
 * een productie-instantie vervangt dit door een persistente store zonder de
 * invarianten of het API-contract te wijzigen (ARCHITECTURE.md §7).
 */
export class OpenBodStore {
  private listings = new Map<string, ListingRecord>();
  readonly keypair = new InstanceKeypair();

  createListing(input: CreateListingInput): Listing {
    if (new Date(input.deadline).getTime() <= Date.now()) {
      throw new RuleViolationError("sluitingsdatum ligt in het verleden");
    }
    const id = randomUUID();
    const listing: Listing = {
      id,
      address: input.address,
      prijsVorm: input.prijsVorm,
      askingPrice: input.askingPrice,
      verkoopmethode: input.verkoopmethode,
      deadline: input.deadline,
      rules: input.rules,
      takeoverItems: input.takeoverItems.map((item) => ({ ...item, itemId: randomUUID() })),
      status: "biedfase",
      createdAt: new Date().toISOString(),
    };
    const chain = new HashChain();
    chain.append("listing_opened", sha256Hex(canonicalize({ id, deadline: input.deadline })));
    this.listings.set(id, { listing, chain, bids: new Map() });
    return listing;
  }

  getListing(id: string): Listing {
    return this.record(id).listing;
  }

  allListings(): Listing[] {
    return [...this.listings.values()].map((rec) => rec.listing);
  }

  bidCount(id: string): number {
    const rec = this.record(id);
    return [...rec.bids.values()].filter((b) => !b.withdrawn).length;
  }

  /** Het lopende bod van deze bieder, of undefined. Ingetrokken biedingen tellen niet mee. */
  activeBidFor(listingId: string, bidderSub: string): SealedBid | undefined {
    const rec = this.record(listingId);
    return [...rec.bids.values()].find((b) => b.bidderSub === bidderSub && !b.withdrawn);
  }

  /** Het ontvangstbewijs van je eigen lopende bod, zodat je het later kunt narekenen. */
  receiptForBidder(listingId: string, bidderSub: string): BidReceipt | undefined {
    const sealed = this.activeBidFor(listingId, bidderSub);
    if (!sealed) return undefined;
    return this.receiptFor(this.record(listingId), sealed, sealed.logIndex);
  }

  placeBid(listingId: string, bidderSub: string, commitment: string, ciphertext: string): BidReceipt {
    const rec = this.record(listingId);
    this.assertBiedfase(rec);
    // Eén lopend bod per bieder per woning. Zonder deze regel kan één account het
    // veld vullen met tien biedingen, en dat vertekent zowel het zichtbare aantal
    // als het beeld dat de verkoper bij de onthulling krijgt. Wie zijn bod wil
    // veranderen, past het aan (`adjustBid`) — dat blijft zichtbaar in het logboek.
    if (this.activeBidFor(listingId, bidderSub)) {
      throw new RuleViolationError("je hebt al een lopend bod op deze woning; pas het aan of trek het eerst in");
    }
    const bidId = randomUUID();
    const now = new Date().toISOString();
    const entry = rec.chain.append("bid_placed", sha256Hex(commitment));
    const sealed: SealedBid = {
      bidId,
      listingId,
      bidderSub,
      commitment,
      ciphertext,
      version: 1,
      withdrawn: false,
      createdAt: now,
      updatedAt: now,
      logIndex: entry.index,
    };
    rec.bids.set(bidId, sealed);
    return this.receiptFor(rec, sealed, entry.index);
  }

  adjustBid(listingId: string, bidId: string, bidderSub: string, commitment: string, ciphertext: string): BidReceipt {
    const rec = this.record(listingId);
    this.assertBiedfase(rec);
    if (!rec.listing.rules.aanpassenToegestaan) {
      throw new RuleViolationError("aanpassen is niet toegestaan voor deze woning");
    }
    const existing = rec.bids.get(bidId);
    if (!existing || existing.bidderSub !== bidderSub || existing.withdrawn) {
      throw new RuleViolationError("bod niet gevonden of niet van deze bieder");
    }
    const entry = rec.chain.append("bid_adjusted", sha256Hex(commitment));
    const updated: SealedBid = {
      ...existing,
      commitment,
      ciphertext,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
      logIndex: entry.index,
    };
    rec.bids.set(bidId, updated);
    return this.receiptFor(rec, updated, entry.index);
  }

  withdrawBid(listingId: string, bidId: string, bidderSub: string): void {
    const rec = this.record(listingId);
    this.assertBiedfase(rec);
    if (!rec.listing.rules.intrekkenToegestaan) {
      throw new RuleViolationError("intrekken is niet toegestaan voor deze woning");
    }
    const existing = rec.bids.get(bidId);
    if (!existing || existing.bidderSub !== bidderSub || existing.withdrawn) {
      throw new RuleViolationError("bod niet gevonden of niet van deze bieder");
    }
    existing.withdrawn = true;
    existing.updatedAt = new Date().toISOString();
    rec.chain.append("bid_withdrawn", sha256Hex(existing.commitment));
  }

  closeListing(listingId: string): Listing {
    const rec = this.record(listingId);
    if (rec.listing.status !== "biedfase") {
      throw new InvalidTransitionError(`kan niet sluiten vanuit status ${rec.listing.status}`);
    }
    rec.listing.status = "gesloten";
    rec.chain.append("listing_closed", sha256Hex(rec.listing.id));
    return rec.listing;
  }

  /**
   * Onthulling: ontsleutelt alle geldige (niet-ingetrokken) biedingen en valideert
   * tegen hun commitment (I2).
   *
   * De statuscheck alleen is niet genoeg. Onthullen duurt seconden (drand ophalen
   * plus decryptie per bod) en de scheduler in de API roept dit herhaald aan zolang
   * de status "gesloten" is. Zonder deze guard passeert een tweede aanroep de check
   * terwijl de eerste nog await't, en komen dezelfde biedingen twee keer als
   * `bid_revealed` in de hashketen — een logboek dat klopt qua hashes maar liegt
   * over wat er gebeurd is. Gelijktijdige aanroepen delen daarom één onthulling.
   */
  revealListing(listingId: string): Promise<Logbook> {
    const rec = this.record(listingId);
    if (rec.revealing) return rec.revealing;
    if (rec.listing.status !== "gesloten") {
      return Promise.reject(
        new InvalidTransitionError(`kan niet onthullen vanuit status ${rec.listing.status}`),
      );
    }
    // Mislukt de onthulling (bijvoorbeeld drand onbereikbaar), dan geven we de
    // sleutel terug vrij zodat de scheduler het opnieuw mag proberen.
    rec.revealing = this.performReveal(rec).finally(() => {
      rec.revealing = undefined;
    });
    return rec.revealing;
  }

  private async performReveal(rec: ListingRecord): Promise<Logbook> {
    const active = [...rec.bids.values()].filter((b) => !b.withdrawn);
    const revealed: RevealedBid[] = [];
    for (const sealed of active) {
      const bid = await revealBid(sealed);
      revealed.push(bid);
      rec.chain.append("bid_revealed", sha256Hex(canonicalize({ bidId: bid.bidId, valid: bid.valid })));
    }
    rec.revealed = revealed;
    rec.listing.status = "onthuld";
    rec.logbook = generatePublicLogbook(rec.listing, revealed, rec.chain.all(), this.keypair);
    return rec.logbook;
  }

  getRevealed(listingId: string): RevealedBid[] {
    const rec = this.record(listingId);
    if (!rec.revealed) throw new InvalidTransitionError("nog niet onthuld");
    return rec.revealed;
  }

  getLogbook(listingId: string): Logbook {
    const rec = this.record(listingId);
    if (!rec.logbook) throw new InvalidTransitionError("nog niet onthuld");
    return rec.logbook;
  }

  getLog(listingId: string) {
    return this.record(listingId).chain.all();
  }

  getProof(listingId: string, bidId: string) {
    const rec = this.record(listingId);
    const entries = rec.chain.all().filter((e) => e.type === "bid_placed" || e.type === "bid_adjusted");
    const sealed = rec.bids.get(bidId);
    if (!sealed) throw new ListingNotFoundError("bod niet gevonden");
    const matching = entries.filter((e) => e.payloadHash === sha256Hex(sealed.commitment));
    return { bidId, listingId, commitment: sealed.commitment, logEntries: matching, fullLog: rec.chain.all() };
  }

  private receiptFor(rec: ListingRecord, sealed: SealedBid, logIndex: number): BidReceipt {
    const entry = rec.chain.all()[logIndex];
    const receipt: Omit<BidReceipt, "instanceSignature"> = {
      bidId: sealed.bidId,
      listingId: sealed.listingId,
      commitment: sealed.commitment,
      logIndex: entry.index,
      prevHash: entry.prevHash,
      entryHash: entry.entryHash,
      timestamp: entry.timestamp,
    };
    return { ...receipt, instanceSignature: this.keypair.sign(canonicalize(receipt)) };
  }

  private assertBiedfase(rec: ListingRecord) {
    if (rec.listing.status !== "biedfase") {
      throw new RuleViolationError("woning accepteert geen biedingen in deze status");
    }
    if (new Date(rec.listing.deadline).getTime() <= Date.now()) {
      throw new RuleViolationError("deadline is verstreken");
    }
  }

  private record(id: string): ListingRecord {
    const rec = this.listings.get(id);
    if (!rec) throw new ListingNotFoundError(`listing ${id} niet gevonden`);
    return rec;
  }
}
