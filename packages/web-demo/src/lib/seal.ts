import { timelockEncrypt, mainnetClient, roundAt, Buffer } from "tlock-js";

/**
 * Verzegeling gebeurt hier, in de browser, nooit op een server (ARCHITECTURE.md §3,
 * protocol.md §5). Dit spiegelt bewust de logica uit @openbod/core/commit en
 * @openbod/core/timelock: dezelfde canonicalisatie en hetzelfde hash-algoritme,
 * maar met Web Crypto in plaats van Node's `node:crypto`, want dit draait in de
 * browser-runtime. Een conformance-suite (spec/protocol.md §10) hoort deze twee
 * implementaties tegen dezelfde testvectoren te toetsen; voor de MVP-demo is dat
 * nog niet geautomatiseerd.
 */

export interface Voorbehoud {
  type: "financieel" | "bouwdepot" | "bouwkundige_keuring" | "verkoop_eigen_woning" | "nhg" | "anders";
  deadline?: string;
  note?: string;
}

export interface OvernameChoice {
  itemId: string;
  choice: "geen" | "gevraagd_bedrag" | "eigen_bod" | "in_overleg";
  amount?: number;
  underReservation?: boolean;
}

export interface BidPayload {
  amount: number;
  handoverDate?: string;
  validUntil?: string;
  conditions: Voorbehoud[];
  motivation?: string;
  takeover: OvernameChoice[];
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealBid(payload: BidPayload, deadlineIso: string) {
  const salt = randomSaltHex();
  const commitment = await sha256Hex(canonicalize(payload) + "|" + salt);

  const client = mainnetClient();
  const info = await client.chain().info();
  const round = roundAt(new Date(deadlineIso).getTime(), info);

  const envelope = canonicalize({ payload, salt });
  const ciphertext = await timelockEncrypt(round, Buffer.from(envelope, "utf8"), client);

  return { commitment, ciphertext };
}
