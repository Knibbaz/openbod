import type { LogEntry } from "./api";

const GENESIS_HASH = "0".repeat(64);

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Herrekent de hashketen in de browser, onafhankelijk van wat de API beweert
 * (I3, I8). Dit is dezelfde herrekening als HashChain.verify in @openbod/core,
 * hier client-side zodat "controleer het zelf" ook echt in de browser gebeurt.
 * Handtekeningverificatie (Ed25519) hoort hier niet bij nog — gebruik daarvoor
 * de `openbod-verify`-CLI (packages/verifier), die het volledige bewijs checkt.
 */
export async function verifyHashChainInBrowser(entries: LogEntry[]): Promise<{ valid: boolean; firstBrokenIndex?: number }> {
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    const expected = await sha256Hex([entry.index, entry.timestamp, entry.type, entry.payloadHash, entry.prevHash].join("|"));
    if (entry.prevHash !== prevHash || entry.entryHash !== expected) {
      return { valid: false, firstBrokenIndex: entry.index };
    }
    prevHash = entry.entryHash;
  }
  return { valid: true };
}
