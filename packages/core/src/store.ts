import { randomUUID } from "node:crypto";
import { HashChain } from "./log/hashchain.js";
import { InstanceKeypair } from "./log/signing.js";
import { revealBid } from "./reveal/reveal.js";
import { generatePublicLogbook, bidderRef, type Logbook } from "./logbook/logbook.js";
import {
  ConsoleLogbookDelivery,
  type LogbookDelivery,
} from "./logbook/delivery.js";
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
  /** JWK van de verkoper; bieders versleutelen hun identiteit hiernaartoe (I12). */
  sellerPublicKey?: string;
  /** Pseudonieme sub van de verkoper, zodat ook hij het logboek automatisch krijgt (E4-S3). */
  sellerSub?: string;
}

/** Uitkomst van een automatische verstrekking van het biedlogboek (E4-S3). */
export interface DeliveryResult {
  listingId: string;
  /** Pseudonieme refs van de ontvangers; nooit adressen, ook niet intern. */
  recipientRefs: string[];
  deliveredAt: string;
  logIndex: number;
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
  /** Zie `deliverLogbook`: zelfde bescherming tegen dubbele verzendregels. */
  delivering?: Promise<DeliveryResult>;
  delivery?: DeliveryResult;
}

/**
 * In-memory referentie-implementatie van de core-orchestratie. Voor de MVP-demo;
 * een productie-instantie vervangt dit door een persistente store zonder de
 * invarianten of het API-contract te wijzigen (ARCHITECTURE.md §7).
 */
export class OpenBodStore {
  private listings = new Map<string, ListingRecord>();
  readonly keypair = new InstanceKeypair();

  /**
   * Het kanaal waarlangs het biedlogboek automatisch naar alle betrokkenen gaat
   * (E4-S3). Standaard een luide no-op, zodat een verkeerd geconfigureerde
   * instantie zichtbaar niets verstuurt in plaats van stil te falen.
   */
  constructor(private readonly deliveryChannel: LogbookDelivery = new ConsoleLogbookDelivery()) {}

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
      sellerPublicKey: input.sellerPublicKey,
      sellerSub: input.sellerSub,
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

  placeBid(
    listingId: string,
    bidderSub: string,
    commitment: string,
    ciphertext: string,
    identityEnvelope?: string,
  ): BidReceipt {
    const rec = this.record(listingId);
    this.assertBiedfase(rec);
    // Eén lopend bod per bieder per woning. Zonder deze regel kan één account het
    // veld vullen met tien biedingen, en dat vertekent zowel het zichtbare aantal
    // als het beeld dat de verkoper bij de onthulling krijgt. Wie zijn bod wil
    // veranderen, past het aan (`adjustBid`); dat blijft zichtbaar in het logboek.
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
      identityEnvelope,
    };
    rec.bids.set(bidId, sealed);
    return this.receiptFor(rec, sealed, entry.index);
  }

  adjustBid(
    listingId: string,
    bidId: string,
    bidderSub: string,
    commitment: string,
    ciphertext: string,
    identityEnvelope?: string,
  ): BidReceipt {
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
      identityEnvelope: identityEnvelope ?? existing.identityEnvelope,
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
   * `bid_revealed` in de hashketen: een logboek dat klopt qua hashes maar liegt
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

  /**
   * Gunning (protocol.md §4, §5a). Legt de keuze vast en geeft uitsluitend de
   * identiteitsenvelop van het gekozen bod vrij. De instantie kan die envelop
   * zelf niet openen, want alleen de verkoper heeft de sleutel, maar dát zij is
   * vrijgegeven wordt gelogd, zodat achteraf zichtbaar is wanneer de identiteit
   * van welke bieder beschikbaar kwam (I12).
   */
  awardListing(listingId: string, bidId: string): { bidId: string; identityEnvelope?: string; logbook: Logbook } {
    const rec = this.record(listingId);
    if (rec.listing.status !== "onthuld") {
      throw new InvalidTransitionError(`kan niet gunnen vanuit status ${rec.listing.status}`);
    }
    const sealed = rec.bids.get(bidId);
    if (!sealed || sealed.withdrawn) {
      throw new RuleViolationError("bod niet gevonden of ingetrokken");
    }
    const revealed = rec.revealed?.find((b) => b.bidId === bidId);
    if (!revealed?.valid) {
      throw new RuleViolationError("er kan alleen gegund worden aan een geldig onthuld bod");
    }

    rec.chain.append("gegund", sha256Hex(canonicalize({ listingId, bidId })));
    if (sealed.identityEnvelope) {
      rec.chain.append("identiteit_vrijgegeven", sha256Hex(canonicalize({ listingId, bidId })));
    }
    rec.listing.awardedBidId = bidId;
    rec.listing.status = "onherroepelijk";
    // Het logboek is bij de onthulling gegenereerd en mist de gunningsregels;
    // opnieuw genereren houdt het logboek gelijk aan de keten.
    rec.logbook = generatePublicLogbook(rec.listing, rec.revealed ?? [], rec.chain.all(), this.keypair);

    return { bidId, identityEnvelope: sealed.identityEnvelope, logbook: rec.logbook };
  }

  /**
   * Afhandeling buiten deze procedure om (E7-S2). De verkoop is ingetrokken,
   * onderhands gesloten of anderszins gestopt zonder gunning via de deadline.
   *
   * Dit bestaat omdat het ontbreken ervan een van de klachten uit het VEH-meldpunt
   * is: een gesloten inschrijving waarbij de woning tóch buiten de procedure om
   * wordt verkocht, en waarvan achteraf niets te reconstrueren valt. Het systeem
   * kan zo'n verkoop niet verhinderen, want het gebeurt per definitie buiten het
   * systeem, maar het kan wél afdwingen dat de procedure een eindstatus met een
   * opgegeven reden krijgt, en dat alle bieders daarover automatisch het logboek
   * ontvangen. Een makelaar die dit niet vastlegt, laat een aantoonbaar
   * onafgemaakt logboek achter (I13).
   *
   * Nog niet onthulde biedingen blijven verzegeld: ze worden niet alsnog geopend,
   * want de procedure waarvoor ze bedoeld waren gaat niet door. Wat de bieders
   * krijgen is het bewijs dát hun verzegelde bod er stond en dat het nooit is
   * geopend, precies het punt waarop zij nu in het duister tasten.
   */
  abortListing(listingId: string, reason: string): Logbook {
    const rec = this.record(listingId);
    const previousStatus = rec.listing.status;
    if (previousStatus === "onherroepelijk" || previousStatus === "buiten_procedure") {
      throw new InvalidTransitionError(`procedure is al afgerond met status ${previousStatus}`);
    }
    if (rec.revealing) {
      throw new InvalidTransitionError("onthulling loopt; probeer het zo opnieuw");
    }
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new RuleViolationError("een reden is verplicht bij afhandeling buiten de procedure");
    }

    const at = new Date().toISOString();
    rec.chain.append(
      "buiten_procedure_afgehandeld",
      sha256Hex(canonicalize({ listingId, previousStatus, reason: trimmed })),
    );
    rec.listing.status = "buiten_procedure";
    rec.listing.buitenProcedureReden = trimmed;
    rec.listing.buitenProcedureAt = at;
    rec.logbook = generatePublicLogbook(rec.listing, rec.revealed ?? [], rec.chain.all(), this.keypair);
    return rec.logbook;
  }

  /** Is het logboek van deze woning al automatisch verstuurd? */
  logbookDelivery(listingId: string): DeliveryResult | undefined {
    return this.record(listingId).delivery;
  }

  /**
   * Automatische verstrekking van het biedlogboek (E4-S3). Sinds 2023 is het
   * biedlogboek verplicht, maar in de praktijk kreeg ongeveer een derde van de
   * kopers het, en dan meestal pas na erom te vragen. Daarom is verstrekken
   * hier geen knop maar een gevolg: zodra de procedure een eindstatus bereikt
   * (gegund of buiten de procedure afgehandeld) gaat het logboek vanzelf naar
   * alle betrokkenen.
   *
   * De verzending zelf wordt een regel in de hashketen. Dat is het punt: "ik heb
   * nooit een logboek gekregen" wordt daarmee een controleerbare bewering in
   * plaats van welles-nietes. In de logregel staan alleen pseudonieme refs, dus
   * er komen geen persoonsgegevens in de keten (I14).
   *
   * Idempotent, net als `revealListing`: de scheduler roept dit herhaald aan en
   * mag geen tweede `logboek_verstuurd` in de keten veroorzaken.
   */
  deliverLogbook(listingId: string): Promise<DeliveryResult> {
    const rec = this.record(listingId);
    if (rec.delivery) return Promise.resolve(rec.delivery);
    if (rec.delivering) return rec.delivering;
    if (rec.listing.status !== "onherroepelijk" && rec.listing.status !== "buiten_procedure") {
      return Promise.reject(
        new InvalidTransitionError(`logboek wordt pas verstuurd bij een eindstatus, niet bij ${rec.listing.status}`),
      );
    }
    if (!rec.logbook) {
      return Promise.reject(new InvalidTransitionError("er is nog geen logboek om te versturen"));
    }
    // Mislukt de bezorging (identity-backend onbereikbaar), dan geven we de
    // sleutel weer vrij zodat de scheduler het opnieuw probeert. Er komt dan
    // ook geen `logboek_verstuurd` in de keten te staan: de keten liegt liever
    // niet dan dat zij een verzending claimt die niet plaatsvond.
    rec.delivering = this.performDelivery(rec).finally(() => {
      rec.delivering = undefined;
    });
    return rec.delivering;
  }

  private async performDelivery(rec: ListingRecord): Promise<DeliveryResult> {
    const logbook = rec.logbook!;
    // Ook ingetrokken biedingen tellen mee: wie heeft meegedaan, is betrokkene.
    const subs = new Set([...rec.bids.values()].map((b) => b.bidderSub));
    if (rec.listing.sellerSub) subs.add(rec.listing.sellerSub);
    const recipients = [...subs];

    await this.deliveryChannel.deliver({ listingId: rec.listing.id, recipients, logbook });

    const deliveredAt = new Date().toISOString();
    const recipientRefs = recipients.map(bidderRef).sort();
    const entry = rec.chain.append(
      "logboek_verstuurd",
      sha256Hex(canonicalize({ rootHash: logbook.rootHash, recipientRefs })),
    );
    rec.delivery = { listingId: rec.listing.id, recipientRefs, deliveredAt, logIndex: entry.index };
    return rec.delivery;
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
