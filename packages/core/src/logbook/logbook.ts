import type { Listing, LogEntry, RevealedBid } from "../model/types.js";
import { canonicalize } from "../commit/canonical.js";
import { sha256Hex } from "../commit/hash.js";
import type { InstanceKeypair } from "../log/signing.js";

export interface PublicLogbookEntry {
  bidderRef: string;
  amount: number;
  handoverDate?: string;
  validUntil?: string;
  conditions: RevealedBid["conditions"];
  takeover: RevealedBid["takeover"];
  valid: boolean;
  invalidReason?: string;
}

/** Het NTA 8061-biedlogboek. Openbare versie bevat geen motivatie of herleidbare identiteit (I11). */
export interface Logbook {
  listing: Pick<Listing, "id" | "address" | "prijsVorm" | "verkoopmethode" | "deadline">;
  entries: PublicLogbookEntry[];
  log: LogEntry[];
  rootHash: string;
  generatedAt: string;
  signature: string;
  signerPublicKey: string;
}

export function generatePublicLogbook(
  listing: Listing,
  revealed: RevealedBid[],
  log: LogEntry[],
  keypair: InstanceKeypair,
): Logbook {
  const entries: PublicLogbookEntry[] = revealed.map((bid, i) => ({
    bidderRef: `bieder-${sha256Hex(bid.bidderSub).slice(0, 8)}`,
    amount: bid.amount,
    handoverDate: bid.handoverDate,
    validUntil: bid.validUntil,
    conditions: bid.conditions,
    takeover: bid.takeover,
    valid: bid.valid,
    invalidReason: bid.invalidReason,
  }));

  const rootHash = log.length > 0 ? log[log.length - 1].entryHash : sha256Hex("");
  const generatedAt = new Date().toISOString();

  const unsigned = { listing: pickListingFields(listing), entries, log, rootHash, generatedAt };
  const signature = keypair.sign(canonicalize(unsigned));

  return {
    ...unsigned,
    signature,
    signerPublicKey: keypair.publicKeyPem(),
  };
}

function pickListingFields(listing: Listing) {
  return {
    id: listing.id,
    address: listing.address,
    prijsVorm: listing.prijsVorm,
    verkoopmethode: listing.verkoopmethode,
    deadline: listing.deadline,
  };
}
