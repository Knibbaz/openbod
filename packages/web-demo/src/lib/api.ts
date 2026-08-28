import type { OvernameChoice, Voorbehoud } from "./seal";

export const CORE_URL = import.meta.env.VITE_CORE_URL ?? "http://localhost:4000";
export const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL ?? "http://localhost:4001";

export type OvernameStatus = "blijft_achter" | "gevraagd_bedrag" | "in_overleg" | "niet_beschikbaar";

export interface TakeoverItem {
  itemId: string;
  label: string;
  status: OvernameStatus;
  amount?: number;
}

export interface Listing {
  id: string;
  address: string;
  prijsVorm: "vraagprijs" | "richtprijs" | "bieden_vanaf";
  askingPrice?: number;
  verkoopmethode: "inschrijving" | "onderhandeling" | "bieden_met_deadline";
  deadline: string;
  rules: { intrekkenToegestaan: boolean; aanpassenToegestaan: boolean; aantalBiedingenZichtbaar: boolean };
  takeoverItems: TakeoverItem[];
  status: "aangemaakt" | "biedfase" | "gesloten" | "onthuld" | "onherroepelijk";
  createdAt: string;
  bidCount?: number;
  sellerPublicKey?: string;
  awardedBidId?: string;
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

/** Wat de core over je eigen bod kan zeggen: nooit het bedrag, wél het bewijs. */
export interface MyBid extends BidReceipt {
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  index: number;
  timestamp: string;
  type: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
}

export interface Logbook {
  listing: Pick<Listing, "id" | "address" | "prijsVorm" | "verkoopmethode" | "deadline">;
  entries: {
    bidId: string;
    bidderRef: string;
    amount: number;
    handoverDate?: string;
    validUntil?: string;
    conditions: Voorbehoud[];
    takeover: OvernameChoice[];
    valid: boolean;
    invalidReason?: string;
  }[];
  log: LogEntry[];
  rootHash: string;
  generatedAt: string;
  signature: string;
  signerPublicKey: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getToken(): string | null {
  return localStorage.getItem("openbod_token");
}

export function setToken(token: string) {
  localStorage.setItem("openbod_token", token);
}

export function clearToken() {
  localStorage.removeItem("openbod_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export const identityApi = {
  async requestMagicLink(email: string) {
    const res = await fetch(`${IDENTITY_URL}/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // devLink/devToken zijn alleen aanwezig buiten productie (identity geeft
    // ze dan bewust niet terug, zie packages/identity/src/server.ts).
    return json<{ message: string; devLink?: string; devToken?: string }>(res);
  },
  async consume(token: string) {
    const res = await fetch(`${IDENTITY_URL}/consume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return json<{ accessToken: string }>(res);
  },
};

export const coreApi = {
  async listListings() {
    return json<Listing[]>(await fetch(`${CORE_URL}/listings`));
  },
  async getListing(id: string) {
    return json<Listing>(await fetch(`${CORE_URL}/listings/${id}`));
  },
  async createListing(input: unknown) {
    const res = await fetch(`${CORE_URL}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return json<Listing>(res);
  },
  async placeBid(listingId: string, commitment: string, ciphertext: string, identityEnvelope?: string) {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/bids`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ commitment, ciphertext, identityEnvelope }),
    });
    return json<BidReceipt>(res);
  },
  /** Gunning: de core geeft alleen de envelop van dit bod terug, die hij zelf niet kan openen. */
  async award(listingId: string, bidId: string) {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/award`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ bidId }),
    });
    return json<{ bidId: string; identityEnvelope?: string; logbook: Logbook }>(res);
  },
  async adjustBid(
    listingId: string,
    bidId: string,
    commitment: string,
    ciphertext: string,
    identityEnvelope?: string,
  ) {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/bids/${bidId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ commitment, ciphertext, identityEnvelope }),
    });
    return json<BidReceipt>(res);
  },
  async withdrawBid(listingId: string, bidId: string) {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/bids/${bidId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
  /** null als je (nog) geen lopend bod hebt; 404 is hier een normaal antwoord. */
  async getMyBid(listingId: string): Promise<MyBid | null> {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/my-bid`, { headers: authHeaders() });
    if (res.status === 404 || res.status === 401) return null;
    return json<MyBid>(res);
  },
  async getLogbook(listingId: string) {
    return json<Logbook>(await fetch(`${CORE_URL}/listings/${listingId}/logbook`));
  },
};
