import { CORE_URL, getToken } from "./api";

/**
 * Een bod als concept bewaren.
 *
 * Een koper is niet altijd in één zitting klaar: er moet nog gebeld worden met
 * de hypotheekadviseur, of er komt morgen een gesprek. Dat hij dan opnieuw moet
 * beginnen is onnodig vervelend.
 *
 * Dit stond eerder alleen in de browser, zodat de instantie er niets van wist.
 * Dat had een prijs die zwaarder woog dan gedacht: op een ander apparaat, na
 * het wissen van browsergegevens of na een nieuwe laptop was het concept weg.
 * Voor een koper die één keer in zijn leven een huis koopt, is dat het verkeerde
 * moment om opnieuw te moeten beginnen.
 *
 * Wat het kost, en dat hoort de bieder te weten: een concept is niet verzegeld.
 * Wie de instantie beheert kan het lezen, inclusief het bedrag. Daarom is een
 * concept ook geen bod. Het staat niet in het logboek, het telt nergens mee, en
 * pas als het verzegeld verstuurd is geldt de garantie dat niemand het kan lezen
 * voordat de sluitingstijd verstrijkt.
 */

/** Wat het biedformulier invult; bewust hetzelfde als de velden op het scherm. */
export interface Concept {
  amount: number;
  motivation: string;
  handoverDate: string;
  validUntil: string;
  conditions: Record<string, { selected: boolean; deadline: string; note: string }>;
  takeover: Record<string, { choice: string; amount: string }>;
  bidderName: string;
  bidderContact: string;
  savedAt: string;
}

function headers(): Record<string, string> {
  const token = getToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function saveConcept(
  listingId: string,
  concept: Omit<Concept, "savedAt">,
): Promise<Concept> {
  const res = await fetch(`${CORE_URL}/listings/${listingId}/draft`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(concept),
  });
  if (!res.ok) throw new Error(`concept bewaren mislukt (HTTP ${res.status})`);
  return { ...concept, savedAt: new Date().toISOString() };
}

export async function loadConcept(listingId: string): Promise<Concept | null> {
  if (!getToken()) return null;
  const res = await fetch(`${CORE_URL}/listings/${listingId}/draft`, { headers: headers() });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as Concept;
}

export async function clearConcept(listingId: string): Promise<void> {
  if (!getToken()) return;
  await fetch(`${CORE_URL}/listings/${listingId}/draft`, { method: "DELETE", headers: headers() });
}
