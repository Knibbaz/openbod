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

export const sealedBidBody = z
  .object({
    commitment: sha256HexSchema,
    ciphertext: ciphertextSchema,
  })
  .strict(); // weigert onbekende velden zoals "amount" — geen plaintext mag meekomen (I1)

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
  status: z.enum(["aangemaakt", "biedfase", "gesloten", "onthuld", "onherroepelijk"]),
  createdAt: z.string(),
  bidCount: z.number().int().nonnegative().optional(),
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
  type: z.enum(["listing_opened", "bid_placed", "bid_adjusted", "bid_withdrawn", "listing_closed", "bid_revealed"]),
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
  }),
  entries: z.array(
    z.object({
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
