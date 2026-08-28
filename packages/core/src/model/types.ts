export type VoorbehoudType =
  | "financieel"
  | "bouwdepot"
  | "bouwkundige_keuring"
  | "verkoop_eigen_woning"
  | "nhg"
  | "anders";

export interface Voorbehoud {
  type: VoorbehoudType;
  deadline?: string;
  note?: string;
}

export type OvernameStatus = "blijft_achter" | "gevraagd_bedrag" | "in_overleg" | "niet_beschikbaar";

export interface OvernameItem {
  itemId: string;
  label: string;
  status: OvernameStatus;
  amount?: number;
}

export type OvernameChoiceValue = "geen" | "gevraagd_bedrag" | "eigen_bod" | "in_overleg";

export interface OvernameChoice {
  itemId: string;
  choice: OvernameChoiceValue;
  amount?: number;
  underReservation?: boolean;
}

/** Het volledige, canoniek serialiseerbare biedpakket. Zit binnen de timelocked ciphertext. */
export interface BidPayload {
  amount: number;
  handoverDate?: string;
  validUntil?: string;
  conditions: Voorbehoud[];
  motivation?: string;
  takeover: OvernameChoice[];
}

export type ListingStatus =
  | "aangemaakt"
  | "biedfase"
  | "gesloten"
  | "onthuld"
  | "onherroepelijk";

export type PrijsVorm = "vraagprijs" | "richtprijs" | "bieden_vanaf";
export type Verkoopmethode = "inschrijving" | "onderhandeling" | "bieden_met_deadline";

export interface ListingRules {
  intrekkenToegestaan: boolean;
  aanpassenToegestaan: boolean;
  aantalBiedingenZichtbaar: boolean;
}

export interface Listing {
  id: string;
  address: string;
  prijsVorm: PrijsVorm;
  askingPrice?: number;
  verkoopmethode: Verkoopmethode;
  deadline: string;
  rules: ListingRules;
  takeoverItems: OvernameItem[];
  status: ListingStatus;
  createdAt: string;
}

/** Wat de core daadwerkelijk opslaat vóór de onthulling: nooit leesbare inhoud. */
export interface SealedBid {
  bidId: string;
  listingId: string;
  bidderSub: string;
  commitment: string;
  ciphertext: string;
  version: number;
  withdrawn: boolean;
  createdAt: string;
  updatedAt: string;
  /** Index van de logregel die dit bod het laatst vastlegde (plaatsen of aanpassen). */
  logIndex: number;
}

export interface RevealedBid extends BidPayload {
  bidId: string;
  listingId: string;
  bidderSub: string;
  valid: boolean;
  invalidReason?: string;
}

export type LogEntryType =
  | "listing_opened"
  | "bid_placed"
  | "bid_adjusted"
  | "bid_withdrawn"
  | "listing_closed"
  | "bid_revealed";

export interface LogEntry {
  index: number;
  timestamp: string;
  type: LogEntryType;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
}

export interface BidReceipt {
  bidId: string;
  listingId: string;
  commitment: string;
  logIndex: number;
  prevHash: string;
  entryHash: string;
  timestamp: string;
  instanceSignature: string;
}
