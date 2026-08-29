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
  | "onherroepelijk"
  /**
   * De procedure is buiten dit systeem om afgehandeld: ingetrokken, onderhands
   * verkocht, of anderszins gestopt zonder gunning via de deadline. Dit is een
   * eindstatus (protocol.md §5b). Hij bestaat omdat het niet hebben van zo'n
   * status precies de klacht is die kopers melden: een inschrijving die stilvalt
   * en waarvan achteraf niemand kan aantonen wat er gebeurd is.
   */
  | "buiten_procedure";

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
  /**
   * Publieke sleutel van de verkoper (JWK), waarmee bieders hun identiteit
   * versleutelen (protocol.md §5a, I12). De bijbehorende private sleutel
   * blijft bij de verkoper: de instantie kan identiteiten dus niet lezen.
   */
  sellerPublicKey?: string;
  /** Gezet zodra er gegund is; verwijst naar het gekozen bod. */
  awardedBidId?: string;
  /**
   * Pseudonieme subject van de verkoper (dezelfde vorm als `bidderSub`), zodat
   * het biedlogboek ook naar de verkoper gaat en niet alleen naar de bieders
   * (E4-S3). Optioneel: de MVP kent nog geen volwaardige verkopersrol.
   */
  sellerSub?: string;
  /** Verplichte reden bij status `buiten_procedure`; staat ook in het logboek. */
  buitenProcedureReden?: string;
  /** Moment waarop de procedure buiten het systeem om is afgehandeld. */
  buitenProcedureAt?: string;
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
  /**
   * Ondoorzichtige, naar de verkoper versleutelde identiteit van de bieder
   * (protocol.md §5a). De instantie bewaart dit maar kan het niet openen, en
   * geeft het uitsluitend vrij bij gunning van dít bod.
   */
  identityEnvelope?: string;
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
  | "bid_revealed"
  | "gegund"
  | "identiteit_vrijgegeven"
  /**
   * De procedure is buiten dit systeem om afgehandeld. Legt vast dát en wanneer
   * het gebeurde, plus een hash van de opgegeven reden (I13).
   */
  | "buiten_procedure_afgehandeld"
  /**
   * Het biedlogboek is verstuurd naar alle betrokkenen. Legt de verzending zelf
   * vast in de keten, zodat "ik heb nooit een logboek gekregen" een
   * controleerbare bewering wordt in plaats van welles-nietes (I14).
   */
  | "logboek_verstuurd";

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
