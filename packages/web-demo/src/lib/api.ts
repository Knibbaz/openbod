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
  async placeBid(listingId: string, commitment: string, ciphertext: string) {
    const res = await fetch(`${CORE_URL}/listings/${listingId}/bids`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ commitment, ciphertext }),
    });
    return json<{ bidId: string; logIndex: number; entryHash: string }>(res);
  },
  async getLogbook(listingId: string) {
    return json<Logbook>(await fetch(`${CORE_URL}/listings/${listingId}/logbook`));
  },
};
