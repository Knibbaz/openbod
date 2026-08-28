import { z } from "zod";

/**
 * Validatie die bij het datamodel hoort, niet bij de HTTP-laag. Het
 * belangrijkste stuk hier is `bidPayloadSchema`: de bieder bepaalt zelf de
 * inhoud van de versleutelde payload, dus wat er na de timelock-onthulling
 * uitkomt is net zo min vertrouwd als directe gebruikersinvoer (OWASP:
 * valideer bij elke vertrouwensgrens, ook na decryptie — niet alleen bij de
 * HTTP-rand).
 */

// Alle C0/C1-besturingstekens behalve tab, LF en CR (\x09, \x0A, \x0D).
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;

export const safeText = (max: number, min = 0) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((s) => !CONTROL_CHARS.test(s), {
      message: "bevat niet-toegestane besturingstekens",
    });

export const uuidSchema = z.string().uuid();

export const voorbehoudSchema = z.object({
  type: z.enum(["financieel", "bouwdepot", "bouwkundige_keuring", "verkoop_eigen_woning", "nhg", "anders"]),
  deadline: z.string().datetime().optional(),
  note: safeText(500).optional(),
});

export const overnameChoiceSchema = z.object({
  itemId: uuidSchema,
  choice: z.enum(["geen", "gevraagd_bedrag", "eigen_bod", "in_overleg"]),
  amount: z.number().finite().nonnegative().max(10_000_000).optional(),
  underReservation: z.boolean().optional(),
});

export const bidPayloadSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  handoverDate: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  conditions: z.array(voorbehoudSchema).max(20),
  motivation: safeText(2000).optional(),
  takeover: z.array(overnameChoiceSchema).max(200),
});
