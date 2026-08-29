import { canonicalize } from "../commit/canonical.js";
import { sha256Hex } from "../commit/hash.js";
import type { Kenmerken, ListingRules, OvernameItem, PrijsVorm, Verkoopmethode } from "./types.js";

/**
 * Alles wat een bieder te zien kreeg toen hij besloot te bieden (I15).
 *
 * Een bod is een reactie op een advertentie. Verandert het woonoppervlak, de
 * lijst achterblijvende zaken of een spelregel na de deadline stilletjes, dan
 * klopt de vergelijking tussen bod en woning niet meer, en dat is niet te zien
 * aan een logboek dat alleen bedragen vastlegt. Door hier één hash van te maken
 * en die in de `listing_opened`-regel te zetten, kan iedereen achteraf narekenen
 * dat het dossier is wat het was.
 *
 * Opmaak hoort hier nadrukkelijk niet in: kleuren, logo's en huisstijl mogen
 * veranderen zonder de integriteit te raken (backlog E1-S3). Wat er wel in zit,
 * is inhoud waarop iemand zijn bod baseert.
 */
export interface Dossier {
  address: string;
  prijsVorm: PrijsVorm;
  askingPrice?: number;
  verkoopmethode: Verkoopmethode;
  deadline: string;
  rules: ListingRules;
  takeoverItems: OvernameItem[];
  fotos: string[];
  omschrijving?: string;
  kenmerken?: Kenmerken;
}

export function computeDossierHash(dossier: Dossier): string {
  return sha256Hex(canonicalize(dossier));
}
