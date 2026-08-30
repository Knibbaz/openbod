import { z } from "zod";
import { safeText, uuidSchema, voorbehoudSchema, overnameChoiceSchema } from "../model/validation.js";

/**
 * HTTP-specifieke validatie: path params en request bodies. De payload-vorm
 * (`bidPayloadSchema`) staat in `model/validation.ts`, want die geldt ook
 * voor de ontsleutelde inhoud na de timelock, niet alleen voor wat er
 * rechtstreeks over HTTP binnenkomt.
 */

export const listingIdParams = z.object({ id: uuidSchema });
export const bidParams = z.object({ id: uuidSchema, bidId: uuidSchema });

export const sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "commitment moet een SHA-256 hex-hash zijn");

// Ciphertexts zijn base64/hex-achtige tlock-age payloads; een bovengrens
// voorkomt dat één bod onevenredig veel geheugen of decryptietijd kost (DoS).
export const ciphertextSchema = z.string().min(1).max(20_000);

// De identiteitsenvelop is versleuteld naar de verkoper en voor de instantie
// ondoorzichtig (protocol.md §5a). Alleen de vorm en een bovengrens worden
// gecontroleerd; de inhoud kan hier per definitie niet gelezen worden.
export const identityEnvelopeSchema = z.string().min(1).max(8_000);

export const sealedBidBody = z
  .object({
    commitment: sha256HexSchema,
    ciphertext: ciphertextSchema,
    identityEnvelope: identityEnvelopeSchema.optional(),
  })
  .strict(); // weigert onbekende velden zoals "amount": geen plaintext mag meekomen (I1)

export const awardBody = z.object({ bidId: uuidSchema }).strict();

/**
 * Een concept: een voorbereid, nog niet verzegeld bod.
 *
 * Let op wat dit is en niet is. Een concept telt nergens mee, staat niet in de
 * hashketen en is geen bod; pas het verzegelde bod op `POST /listings/:id/bids`
 * is dat. Dit is invulhulp, zodat iemand die morgen verder wil niet opnieuw
 * hoeft te beginnen.
 *
 * En let op wat het kost: anders dan een verzegeld bod is dit leesbaar voor wie
 * de instantie beheert, inclusief het bedrag. Daarom is er uitsluitend toegang
 * tot je eigen concept en bestaat er nergens een endpoint dat aantallen of
 * andermans concepten teruggeeft. Zie DEVELOPMENT.md, bekende beperkingen.
 */
export const bidDraftBody = z
  .object({
    amount: z.number().finite().nonnegative().max(1_000_000_000),
    motivation: safeText(2_000).default(""),
    handoverDate: z.string().max(40).default(""),
    validUntil: z.string().max(40).default(""),
    conditions: z
      .record(
        z.object({
          selected: z.boolean(),
          deadline: z.string().max(40).default(""),
          note: safeText(500).default(""),
        }),
      )
      .default({}),
    takeover: z
      .record(z.object({ choice: z.string().max(40), amount: z.string().max(40).default("") }))
      .default({}),
    bidderName: safeText(200).default(""),
    bidderContact: safeText(200).default(""),
  })
  .strict();

export const bidDraftResponse = bidDraftBody.extend({ savedAt: z.string() });

/**
 * Afhandeling buiten de procedure om (E7-S2). De reden is verplicht en komt
 * onverkort in het openbare logboek, dus zij is een procedurele verklaring,
 * geen plek voor persoonsgegevens over bieders.
 */
export const abortBody = z.object({ reason: safeText(500, 3) }).strict();

/**
 * Foto-URL's. De instantie host geen bestanden, dus dit zijn verwijzingen naar
 * elders. Uitsluitend https: een `javascript:`- of `data:`-URL die straks in een
 * `src` belandt is een injectiepad, en http zou een veilige pagina alsnog
 * onveilig maken. Het aantal en de lengte zijn begrensd omdat dit veld anders
 * een gratis opslagplek is.
 */
export const fotoUrlSchema = z
  .string()
  .trim()
  .max(2_000)
  .url()
  .refine((u) => u.toLowerCase().startsWith("https://"), {
    message: "alleen https-URL's zijn toegestaan",
  });

/**
 * Foto's mogen ook bij de instantie zelf vandaan komen, als pad op dezelfde
 * origin: `/demo/zwolle-gevel.svg`. Dat is nodig voor de demo-woningen, die hun
 * beelden uit de repo halen in plaats van van een vreemde host, en het is ook
 * de weg voor een white-label instantie met eigen beeldmateriaal.
 *
 * Alleen een enkele slash aan het begin: `//host/pad` is protocol-relatief en
 * dus wél een andere host, en een `javascript:`- of `data:`-URL begint nooit
 * met een slash. Backslashes weren we omdat browsers die op sommige plekken als
 * slash lezen.
 */
const zelfdeOriginPad = z
  .string()
  .trim()
  .max(2_000)
  .regex(/^\/[^/\\][^\\]*$/, { message: "een eigen pad moet met één slash beginnen" });

export const fotoBronSchema = z.union([fotoUrlSchema, zelfdeOriginPad]);

export const kenmerkenSchema = z
  .object({
    woonoppervlak: z.number().int().positive().max(100_000).optional(),
    perceeloppervlak: z.number().int().positive().max(10_000_000).optional(),
    kamers: z.number().int().positive().max(200).optional(),
    slaapkamers: z.number().int().nonnegative().max(200).optional(),
    bouwjaar: z.number().int().min(1000).max(2200).optional(),
    energielabel: z.enum(["A++++", "A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"]).optional(),
  })
  .strict();

export const createListingBody = z.object({
  address: safeText(200, 3),
  prijsVorm: z.enum(["vraagprijs", "richtprijs", "bieden_vanaf"]),
  askingPrice: z.number().finite().positive().max(1_000_000_000).optional(),
  verkoopmethode: z.enum(["inschrijving", "onderhandeling", "bieden_met_deadline"]),
  deadline: z.string().datetime(),
  rules: z.object({
    intrekkenToegestaan: z.boolean(),
    aanpassenToegestaan: z.boolean(),
    aantalBiedingenZichtbaar: z.boolean(),
  }),
  takeoverItems: z
    .array(
      z.object({
        label: safeText(200, 1),
        status: z.enum(["blijft_achter", "gevraagd_bedrag", "in_overleg", "niet_beschikbaar"]),
        amount: z.number().finite().nonnegative().max(1_000_000).optional(),
      }),
    )
    .max(100),
  // JWK van de verkoper. De bijbehorende private sleutel blijft bij de verkoper;
  // die hoort hier nooit binnen te komen (protocol.md §5a).
  sellerPublicKey: z.string().min(1).max(2_000).optional(),
  // Pseudonieme sub van de verkoper (sha256-hex, zelfde vorm als bidderSub),
  // zodat het logboek straks ook naar hem gaat en niet alleen naar de bieders.
  sellerSub: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  fotos: z.array(fotoBronSchema).max(24).optional(),
  omschrijving: safeText(5_000).optional(),
  kenmerken: kenmerkenSchema.optional(),
  // Pagina van de makelaar of aanbodsite. Zelfde https-eis als bij foto's: dit
  // veld belandt in een href en is anders een injectiepad.
  externeLink: fotoUrlSchema.optional(),
  // Weglaten betekent meteen openstellen, zoals het altijd werkte.
  publiceren: z.boolean().optional(),
});

/**
 * Responseschema's: hier gaat elk antwoord dat de API verstuurt doorheen
 * vóór het de deur uit gaat (zie `sendValidated` in server.ts). `z.object`
 * strip standaard onbekende velden, dus zelfs als interne code per ongeluk
 * een extra veld (zoals `bidderSub`) op een object zet, komt dat nooit in de
 * HTTP-response terecht. Dat is de garantie die "zeker weten dat de response
 * de juiste waarden bevat" hier concreet betekent: whitelist, niet blacklist.
 */

const takeoverItemPublic = z.object({
  itemId: uuidSchema,
  label: z.string(),
  status: z.enum(["blijft_achter", "gevraagd_bedrag", "in_overleg", "niet_beschikbaar"]),
  amount: z.number().optional(),
});

export const listingPublicResponse = z.object({
  id: uuidSchema,
  address: z.string(),
  prijsVorm: z.enum(["vraagprijs", "richtprijs", "bieden_vanaf"]),
  askingPrice: z.number().optional(),
  verkoopmethode: z.enum(["inschrijving", "onderhandeling", "bieden_met_deadline"]),
  deadline: z.string(),
  rules: z.object({
    intrekkenToegestaan: z.boolean(),
    aanpassenToegestaan: z.boolean(),
    aantalBiedingenZichtbaar: z.boolean(),
  }),
  takeoverItems: z.array(takeoverItemPublic),
  status: z.enum(["aangemaakt", "biedfase", "gesloten", "onthuld", "onherroepelijk", "buiten_procedure"]),
  createdAt: z.string(),
  bidCount: z.number().int().nonnegative().optional(),
  sellerPublicKey: z.string().optional(),
  awardedBidId: uuidSchema.optional(),
  buitenProcedureReden: z.string().optional(),
  buitenProcedureAt: z.string().optional(),
  fotos: z.array(z.string()),
  omschrijving: z.string().optional(),
  kenmerken: kenmerkenSchema.optional(),
  externeLink: z.string().optional(),
  // Publiek, want zonder de hash zelf kan niemand narekenen dat het dossier
  // ongewijzigd is (I15).
  dossierHash: z.string(),
});

export const listingListResponse = z.array(listingPublicResponse);

export const receiptResponse = z.object({
  bidId: uuidSchema,
  listingId: uuidSchema,
  commitment: sha256HexSchema,
  logIndex: z.number().int().nonnegative(),
  prevHash: z.string(),
  entryHash: z.string(),
  timestamp: z.string(),
  instanceSignature: z.string(),
});

const logEntryResponse = z.object({
  index: z.number().int().nonnegative(),
  timestamp: z.string(),
  type: z.enum([
    "listing_opened",
    "bid_placed",
    "bid_adjusted",
    "bid_withdrawn",
    "listing_closed",
    "bid_revealed",
    "gegund",
    "identiteit_vrijgegeven",
    "buiten_procedure_afgehandeld",
    "logboek_verstuurd",
  ]),
  payloadHash: z.string(),
  prevHash: z.string(),
  entryHash: z.string(),
});

export const logbookResponse = z.object({
  listing: z.object({
    id: uuidSchema,
    address: z.string(),
    prijsVorm: z.enum(["vraagprijs", "richtprijs", "bieden_vanaf"]),
    verkoopmethode: z.enum(["inschrijving", "onderhandeling", "bieden_met_deadline"]),
    deadline: z.string(),
    status: z.enum(["aangemaakt", "biedfase", "gesloten", "onthuld", "onherroepelijk", "buiten_procedure"]),
    buitenProcedureReden: z.string().optional(),
    buitenProcedureAt: z.string().optional(),
    awardedBidId: uuidSchema.optional(),
  }),
  entries: z.array(
    z.object({
      bidId: uuidSchema,
      bidderRef: z.string(),
      amount: z.number(),
      handoverDate: z.string().optional(),
      validUntil: z.string().optional(),
      conditions: z.array(voorbehoudSchema),
      takeover: z.array(overnameChoiceSchema),
      valid: z.boolean(),
      invalidReason: z.string().optional(),
    }),
  ),
  log: z.array(logEntryResponse),
  rootHash: z.string(),
  generatedAt: z.string(),
  signature: z.string(),
  signerPublicKey: z.string(),
});

export const proofResponse = z.object({
  bidId: uuidSchema,
  listingId: uuidSchema,
  commitment: sha256HexSchema,
  logEntries: z.array(logEntryResponse),
  fullLog: z.array(logEntryResponse),
});

export const instanceKeyResponse = z.object({
  publicKeyPem: z.string(),
});

/** Alleen de envelop van het gegunde bod gaat terug; de instantie kan hem zelf niet openen. */
export const awardResponse = z.object({
  bidId: uuidSchema,
  identityEnvelope: identityEnvelopeSchema.optional(),
  logbook: logbookResponse,
});

/**
 * Je eigen lopende bod. Bevat bewust géén bedrag of ciphertext: de core kan
 * die vóór de deadline zelf niet lezen, en zou ze dus ook niet kunnen tonen.
 * Wat je hier terugkrijgt is het bewijs dát je bod erin zit en wanneer.
 */
export const myBidResponse = z.object({
  bidId: uuidSchema,
  listingId: uuidSchema,
  commitment: sha256HexSchema,
  logIndex: z.number().int().nonnegative(),
  prevHash: z.string(),
  entryHash: z.string(),
  timestamp: z.string(),
  instanceSignature: z.string(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Wat een instantie teruggeeft over de automatische verstrekking van het logboek (E4-S3). */
export const deliveryResponse = z.object({
  listingId: uuidSchema,
  recipientRefs: z.array(z.string()),
  deliveredAt: z.string(),
  logIndex: z.number().int().nonnegative(),
});

/**
 * Adresopzoeking uit open bronnen (E1-S4). Alles optioneel wat de BAG niet
 * altijd heeft: een adres zonder oppervlakte is nog steeds bruikbaar.
 */
/** Vrije tekst van de gebruiker: begrensd, want dit gaat door naar een externe bron. */
export const adresZoekQuery = z.object({ q: z.string().trim().min(3).max(120) });

/** De locatieserver geeft id's als `adr-<hex>`; alleen die vorm gaat door. */
export const adresIdParams = z.object({ adresId: z.string().regex(/^[a-z]{3}-[0-9a-f]{6,64}$/) });

export const adresSuggestieResponse = z.array(
  z.object({ id: z.string(), weergavenaam: z.string() }),
);

export const adresKenmerkenResponse = z.object({
  id: z.string(),
  adres: z.string(),
  straat: z.string(),
  huisnummer: z.string(),
  postcode: z.string().optional(),
  woonplaats: z.string(),
  woonoppervlak: z.number().optional(),
  bouwjaar: z.number().optional(),
  gebruiksdoel: z.string().optional(),
  bron: z.string(),
});
