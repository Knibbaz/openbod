import {
  timelockEncrypt,
  timelockDecrypt,
  mainnetClient,
  roundAt,
  type HttpChainClient,
} from "tlock-js";

/**
 * Timelock via het publieke drand quicknet-netwerk (periode 3s, RFC9380-schema).
 * De versleuteling gebeurt bij de bieder (client), niet in de core (ARCHITECTURE.md §3).
 * De core roept dezelfde functies aan om te ontsleutelen, maar kan dat pas
 * wanneer de rondesleutel na de deadline publiek beschikbaar is. Dat is de
 * eigenschap die "de operator kan niet gluren" wiskundig maakt (I1, I4).
 */

let cachedClient: HttpChainClient | undefined;

export function drandClient(): HttpChainClient {
  if (!cachedClient) {
    cachedClient = mainnetClient();
  }
  return cachedClient;
}

/** Welke drand-ronde hoort bij een deadline (ISO 8601 timestamp)? */
export async function roundForDeadline(deadlineIso: string): Promise<number> {
  const client = drandClient();
  const info = await client.chain().info();
  const deadlineMs = new Date(deadlineIso).getTime();
  return roundAt(deadlineMs, info);
}

export async function encryptToDeadline(plaintext: Buffer, deadlineIso: string): Promise<string> {
  const client = drandClient();
  const round = await roundForDeadline(deadlineIso);
  return timelockEncrypt(round, plaintext, client);
}

/**
 * Ontsleutelt tegen het huidige drand-netwerk. Faalt (werpt) als de ronde
 * nog niet gepubliceerd is, d.w.z. de deadline nog niet verstreken is.
 */
export async function decryptCiphertext(ciphertext: string): Promise<Buffer> {
  const client = drandClient();
  return timelockDecrypt(ciphertext, client);
}
