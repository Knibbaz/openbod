import type {
  LogEntry,
  Listing,
  RevealedBid,
  SealedBid,
} from "../model/types.js";
import type { Logbook } from "../logbook/logbook.js";
import type { DeliveryResult } from "../store.js";

/**
 * Eén woning zoals zij op disk staat: de logregels plus de toestand die eruit
 * volgt. Wat hier uitkomt, gaat ongewijzigd terug het geheugen in; het wordt
 * niet opnieuw berekend. Zie `OpenBodStore.hydrate`.
 */
export interface PersistedListing {
  listing: Listing;
  entries: LogEntry[];
  sealedBids: SealedBid[];
  revealed?: RevealedBid[];
  logbook?: Logbook;
  delivery?: DeliveryResult;
}

/**
 * De poort waarlangs `OpenBodStore` zijn toestand bewaart.
 *
 * Bewust synchroon. Dat is geen gemak maar een garantie: een aanroeper krijgt
 * pas antwoord als de schrijf af is. Crasht de instantie tussen "bod
 * aangenomen" en "bod op disk", dan houdt de bieder een ondertekend
 * ontvangstbewijs vast voor een bod dat de instantie na de herstart niet meer
 * kent, en dat leest als bedrog terwijl het een stroomstoring was.
 *
 * De standaardimplementatie (`NoPersistence`) doet niets. Zo blijven de tests
 * en het lokale werken bij het gedrag dat ze hadden, en kiest alleen een
 * deployment expliciet voor een bestand.
 */
export interface Persistence {
  /** Alles teruglezen bij het opstarten. */
  load(): PersistedListing[];

  /**
   * Eén ondeelbare schrijf. Gooit `fn`, dan is er niets geschreven: de
   * aanroeper mag het geheugen dan ook niet bijwerken.
   */
  transaction(fn: () => void): void;

  saveListing(listing: Listing): void;
  appendLogEntry(listingId: string, entry: LogEntry): void;
  saveSealedBid(bid: SealedBid): void;
  saveRevealed(listingId: string, revealed: RevealedBid[]): void;
  saveLogbook(listingId: string, logbook: Logbook): void;
  saveDelivery(delivery: DeliveryResult): void;

  /**
   * Voorbereide, nog niet verzegelde biedingen (concepten). Bewust géén deel
   * van `OpenBodStore` en géén regel in de hashketen: een concept is geen bod,
   * het telt nergens mee en het hoort de procedure niet aan te raken.
   *
   * Wat hier ligt, is leesbaar voor wie de instantie beheert, inclusief het
   * bedrag. Dat is een bewuste afweging tegen het alternatief (alleen in de
   * browser, dus weg bij een nieuw apparaat), en het is de reden dat er
   * nergens een endpoint mag komen dat aantallen of andermans concepten
   * teruggeeft. Zie DEVELOPMENT.md, bekende beperkingen.
   */
  saveDraft(listingId: string, bidderSub: string, json: string): void;
  loadDraft(listingId: string, bidderSub: string): { json: string; savedAt: string } | undefined;
  deleteDraft(listingId: string, bidderSub: string): void;

  /** Alles wissen. Bestaat voor de demo-instantie; zie `OpenBodStore.clear`. */
  clear(): void;

  close(): void;
}

/** Geen opslag: de instantie vergeet alles bij een herstart. */
export class NoPersistence implements Persistence {
  load(): PersistedListing[] {
    return [];
  }
  transaction(fn: () => void): void {
    fn();
  }
  saveListing(): void {}
  appendLogEntry(): void {}
  saveSealedBid(): void {}
  saveRevealed(): void {}
  saveLogbook(): void {}
  saveDelivery(): void {}
  saveDraft(): void {}
  loadDraft(): undefined {
    return undefined;
  }
  deleteDraft(): void {}
  clear(): void {}
  close(): void {}
}
