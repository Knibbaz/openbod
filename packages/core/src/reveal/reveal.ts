import { z } from "zod";
import { decryptCiphertext } from "../timelock/timelock.js";
import { computeCommitment } from "../commit/hash.js";
import { bidPayloadSchema } from "../model/validation.js";
import type { RevealedBid, SealedBid } from "../model/types.js";

const MAX_PLAINTEXT_BYTES = 32 * 1024;

// Losse vorm-check, alleen om aan `payload`/`salt` te komen. De echte
// inhoudsvalidatie (bidPayloadSchema) gebeurt pas ná de commitment-check,
// zodat "hoort niet bij de commitment" en "voldoet niet aan het schema"
// twee onderscheiden, correct geordende foutredenen blijven (I2 eerst).
const looseEnvelopeSchema = z.object({ payload: z.unknown(), salt: z.string().min(16).max(256) });

/**
 * Onthult één sealed bid: ontsleutelt via de timelock, valideert tegen de
 * opgeslagen commitment (protocol.md §5, invariant I2), en valideert daarna
 * de payload zelf tegen het schema. De payload komt van de bieder (via de
 * ciphertext) en wordt dus behandeld als onvertrouwde input, ook al klopt de
 * commitment: een geldige handtekening/hash bewijst alleen integriteit,
 * niet dat de inhoud zinnig of begrensd is (OWASP: valideer bij elke
 * vertrouwensgrens, ook na decryptie). Niets wordt stilzwijgend weggelaten,
 * altijd een expliciete invalid-markering (I5, I6).
 */
export async function revealBid(sealed: SealedBid): Promise<RevealedBid> {
  let rawPlaintext: Buffer;
  try {
    rawPlaintext = await decryptCiphertext(sealed.ciphertext);
  } catch {
    return invalidReveal(sealed, "kon ciphertext niet ontsleutelen");
  }

  if (rawPlaintext.byteLength > MAX_PLAINTEXT_BYTES) {
    return invalidReveal(sealed, "ontsleutelde payload overschrijdt de maximale grootte");
  }

  let rawEnvelope: unknown;
  try {
    rawEnvelope = JSON.parse(rawPlaintext.toString("utf8"));
  } catch {
    return invalidReveal(sealed, "kon ontsleutelde payload niet parsen als JSON");
  }

  const loose = looseEnvelopeSchema.safeParse(rawEnvelope);
  if (!loose.success) {
    return invalidReveal(sealed, "ontsleutelde payload mist de verwachte structuur (payload/salt)");
  }

  const recomputed = computeCommitment(loose.data.payload, loose.data.salt);
  if (recomputed !== sealed.commitment) {
    return invalidReveal(sealed, "onthuld bod komt niet overeen met de commitment");
  }

  const payload = bidPayloadSchema.safeParse(loose.data.payload);
  if (!payload.success) {
    return invalidReveal(sealed, "bod komt overeen met de commitment maar voldoet niet aan het biedschema");
  }

  return {
    ...payload.data,
    bidId: sealed.bidId,
    listingId: sealed.listingId,
    bidderSub: sealed.bidderSub,
    valid: true,
  };
}

function invalidReveal(sealed: SealedBid, reason: string): RevealedBid {
  return {
    amount: 0,
    conditions: [],
    takeover: [],
    bidId: sealed.bidId,
    listingId: sealed.listingId,
    bidderSub: sealed.bidderSub,
    valid: false,
    invalidReason: reason,
  };
}
