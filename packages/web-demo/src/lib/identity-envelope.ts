/**
 * De identiteitsenvelop (protocol.md §5a, invariant I12).
 *
 * De identiteit van de bieder reist náást het bod, niet erin. Het bod gaat op de
 * deadline via de timelock voor iedereen open; de identiteit juist niet. Zij wordt
 * versleuteld naar de publieke sleutel van de verkoper, dus de instantie en de
 * makelaar kunnen haar op geen enkel moment lezen, want zij hebben de sleutel niet.
 *
 * Schema: ECDH op P-256 met een eenmalig sleutelpaar per envelop, HKDF-SHA-256 naar
 * een AES-256-GCM-sleutel. Het eenmalige sleutelpaar zorgt dat twee enveloppen naar
 * dezelfde verkoper niet aan elkaar te koppelen zijn.
 *
 * Wat dit niet afdwingt: dat de verkoper pas bij gunning kijkt. Hij houdt zijn
 * private sleutel de hele tijd. Die grens is procedureel en gelogd, niet wiskundig;
 * zie protocol.md §5a, waar dat expliciet staat in plaats van weggemoffeld.
 */

export interface BidderIdentity {
  name: string;
  contact: string;
}

interface Envelope {
  v: 1;
  epk: JsonWebKey;
  iv: string;
  ct: string;
}

const KEY_ALG: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const HKDF_INFO = new TextEncoder().encode("openbod/identity-envelope/v1");

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Draait bij de verkoper, bij het aanmaken van de woning. De private sleutel verlaat het apparaat niet. */
export async function generateSellerKeypair(): Promise<{ publicJwk: string; privateJwk: string }> {
  const pair = await crypto.subtle.generateKey(KEY_ALG, true, ["deriveKey", "deriveBits"]);
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { publicJwk: JSON.stringify(publicJwk), privateJwk: JSON.stringify(privateJwk) };
}

async function deriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  // Het ruwe ECDH-resultaat is geen sleutel maar een punt op de curve; het gaat
  // eerst door HKDF. Via deriveBits, want niet elke browser ondersteunt het
  // rechtstreeks afleiden van een HKDF-sleutel uit ECDH.
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: HKDF_INFO },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Draait bij de bieder. Het resultaat is voor de instantie een ondoorzichtige string. */
export async function sealIdentity(sellerPublicJwk: string, identity: BidderIdentity): Promise<string> {
  const sellerKey = await crypto.subtle.importKey("jwk", JSON.parse(sellerPublicJwk), KEY_ALG, false, []);
  const ephemeral = await crypto.subtle.generateKey(KEY_ALG, true, ["deriveKey", "deriveBits"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(ephemeral.privateKey, sellerKey, iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(identity));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const envelope: Envelope = {
    v: 1,
    epk: await crypto.subtle.exportKey("jwk", ephemeral.publicKey),
    iv: toBase64(iv.buffer as ArrayBuffer),
    ct: toBase64(ct),
  };
  return btoa(JSON.stringify(envelope));
}

/** Draait bij de verkoper, na gunning. Faalt als de sleutel niet bij deze envelop hoort. */
export async function openIdentity(sellerPrivateJwk: string, envelope: string): Promise<BidderIdentity> {
  const parsed: Envelope = JSON.parse(atob(envelope));
  if (parsed.v !== 1) throw new Error(`onbekende envelopversie ${parsed.v}`);

  const privateKey = await crypto.subtle.importKey("jwk", JSON.parse(sellerPrivateJwk), KEY_ALG, false, ["deriveBits"]);
  const ephemeralPublic = await crypto.subtle.importKey("jwk", parsed.epk, KEY_ALG, false, []);
  const iv = fromBase64(parsed.iv);
  const key = await deriveAesKey(privateKey, ephemeralPublic, iv);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(parsed.ct));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

const STORAGE_PREFIX = "openbod_seller_key_";

/**
 * De private sleutel van de verkoper hoort bij hem, niet bij de server. In deze demo
 * is dat localStorage; kwijt is kwijt, en dan blijft de identiteit van de winnende
 * bieder onleesbaar. Een echte instantie geeft hier een exporteerbare sleutel met
 * een herstelpad, maar nooit een sleutel die de operator ook heeft.
 */
export function saveSellerKey(listingId: string, privateJwk: string) {
  localStorage.setItem(STORAGE_PREFIX + listingId, privateJwk);
}

export function loadSellerKey(listingId: string): string | null {
  return localStorage.getItem(STORAGE_PREFIX + listingId);
}

/**
 * De woningen waarvan deze browser de verkopersleutel heeft. Dit is wat de
 * beheeromgeving als "van mij" beschouwt. Bewust geen serverbegrip: de server
 * weet niet wie de verkoper is en hoort dat ook niet te weten, dus het bezit
 * van de sleutel is hier het enige eerlijke antwoord op die vraag.
 */
export function listSellerKeyListingIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) ids.push(key.slice(STORAGE_PREFIX.length));
  }
  return ids;
}
