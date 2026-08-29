import { describe, it, expect } from "vitest";
import { inspect } from "node:util";
import { OpenBodStore, sealBid } from "../../src/index.js";

/**
 * Lekcheck: de test die de claim draagt dat de instantie niet kan meekijken
 * (I1) en de identiteit van een bieder op geen enkel moment kan lezen (I12).
 *
 * De aanpak is bewust bot. In plaats van te controleren dat de bekende velden
 * netjes versleuteld zijn, dumpen we de complete objectgraaf van de store en
 * zoeken daarin naar de echte waarden. Een keurige test bewijst alleen dat de
 * velden die we bedacht hebben schoon zijn; deze bewijst dat de waarde nergens
 * staat, ook niet in een cache, een logregel of een veld dat later per ongeluk
 * wordt toegevoegd. Zo'n vergissing hoort deze test te laten falen.
 */

const BEDRAG = 517_293;
const MOTIVATIE = "Wij willen hier onze kinderen zien opgroeien.";
const NAAM = "Alice Jansen";
const CONTACT = "alice.jansen@voorbeeld.nl";

/**
 * Alles wat de instantie in handen heeft, als tekst. `inspect` loopt door Maps,
 * private velden en geneste objecten heen, waar `JSON.stringify` een Map als
 * leeg object zou afdoen en het lek dus zou verbergen.
 */
function dumpVanDeInstantie(store: OpenBodStore): string {
  return inspect(store, { depth: null, maxStringLength: null, maxArrayLength: null });
}

function verwachtAfwezig(dump: string, waarden: string[]) {
  for (const waarde of waarden) {
    expect(dump.toLowerCase()).not.toContain(waarde.toLowerCase());
  }
}

/**
 * Bouwt een identiteitsenvelop volgens hetzelfde schema als de frontend
 * (ECDH P-256, HKDF-SHA-256, AES-256-GCM; zie web-demo/src/lib/identity-envelope.ts).
 * De private sleutel van de verkoper blijft hier in de test en gaat nooit naar
 * de store, precies zoals hij in het echt het apparaat van de verkoper niet verlaat.
 */
async function seglIdentiteit(publicKey: CryptoKey, identiteit: object): Promise<string> {
  const eenmalig = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const gedeeld = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    eenmalig.privateKey,
    256,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdfKey = await crypto.subtle.importKey("raw", gedeeld, "HKDF", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("openbod/test") },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(JSON.stringify(identiteit)),
  );
  return JSON.stringify({
    v: 1,
    epk: await crypto.subtle.exportKey("jwk", eenmalig.publicKey),
    salt: Buffer.from(salt).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    ct: Buffer.from(ct).toString("base64"),
  });
}

describe("Lekcheck: wat de instantie werkelijk in handen heeft (I1, I12)", () => {
  it("houdt bedrag en motivatie onleesbaar tot de deadline, en de identiteit voor altijd", async () => {
    const verkoperSleutels = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const store = new OpenBodStore();
    const deadline = new Date(Date.now() + 4000).toISOString();

    const listing = store.createListing({
      address: "Voorbeeldstraat 1, Amsterdam",
      prijsVorm: "vraagprijs",
      askingPrice: 500000,
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
      takeoverItems: [],
      sellerPublicKey: JSON.stringify(
        await crypto.subtle.exportKey("jwk", verkoperSleutels.publicKey),
      ),
    });

    const sealed = await sealBid(
      { amount: BEDRAG, conditions: [], takeover: [], motivation: MOTIVATIE },
      deadline,
    );
    const envelop = await seglIdentiteit(verkoperSleutels.publicKey, { name: NAAM, contact: CONTACT });
    const receipt = store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext, envelop);

    // Fase 1: vóór de deadline. Niets van het bod is leesbaar, ook niet voor
    // wie de hele store in handen heeft.
    const voorDeadline = dumpVanDeInstantie(store);
    verwachtAfwezig(voorDeadline, [String(BEDRAG), MOTIVATIE, NAAM, CONTACT]);
    // Wat er wél staat, is precies wat er hoort te staan: een commitment en een blob.
    expect(voorDeadline).toContain(sealed.commitment);

    await new Promise((r) => setTimeout(r, 5000));
    store.closeListing(listing.id);
    await store.revealListing(listing.id);

    // Fase 2: na de onthulling. Het bedrag hóórt nu zichtbaar te zijn, dat is
    // het punt van de deadline. De identiteit niet: die zit in een envelop
    // waarvoor deze instantie de sleutel niet heeft en nooit krijgt.
    const naOnthulling = dumpVanDeInstantie(store);
    expect(naOnthulling).toContain(String(BEDRAG));
    verwachtAfwezig(naOnthulling, [NAAM, CONTACT]);

    // Fase 3: na gunning. De envelop gaat de deur uit, maar de instantie heeft
    // hem niet geopend en kan dat ook niet.
    const gunning = store.awardListing(listing.id, receipt.bidId);
    expect(gunning.identityEnvelope).toBe(envelop);
    verwachtAfwezig(dumpVanDeInstantie(store), [NAAM, CONTACT]);

    // En het openbare logboek lekt de motivatie niet (I11), terwijl het bedrag
    // er wel in hoort te staan.
    const logboek = inspect(store.getLogbook(listing.id), { depth: null, maxStringLength: null });
    expect(logboek).toContain(String(BEDRAG));
    verwachtAfwezig(logboek, [MOTIVATIE, NAAM, CONTACT]);
  }, 40_000);

  it("(beveiliging) een ingetrokken bod blijft onleesbaar en verdwijnt niet stilletjes", async () => {
    const store = new OpenBodStore();
    const deadline = new Date(Date.now() + 60_000).toISOString();
    const listing = store.createListing({
      address: "Voorbeeldstraat 2, Utrecht",
      prijsVorm: "richtprijs",
      verkoopmethode: "inschrijving",
      deadline,
      rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: false },
      takeoverItems: [],
    });

    const sealed = await sealBid(
      { amount: BEDRAG, conditions: [], takeover: [], motivation: MOTIVATIE },
      deadline,
    );
    const receipt = store.placeBid(listing.id, "sub-alice", sealed.commitment, sealed.ciphertext);
    store.withdrawBid(listing.id, receipt.bidId, "sub-alice");

    const dump = dumpVanDeInstantie(store);
    verwachtAfwezig(dump, [String(BEDRAG), MOTIVATIE]);
    // I6: intrekken wist niets, het markeert. De historie blijft in de keten staan.
    expect(store.getLog(listing.id).some((e) => e.type === "bid_withdrawn")).toBe(true);
    expect(store.getLog(listing.id).some((e) => e.type === "bid_placed")).toBe(true);
  }, 40_000);
});
