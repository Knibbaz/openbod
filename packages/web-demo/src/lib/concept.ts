/**
 * Een bod als concept bewaren, zonder de server iets te laten weten.
 *
 * Een koper is niet altijd in één zitting klaar: er moet nog gebeld worden met
 * de hypotheekadviseur, of er komt morgen een gesprek. Dat hij dan opnieuw moet
 * beginnen is onnodig vervelend. Maar een concept dat naar de server gaat, zou
 * de instantie vóór de sluitingstijd laten weten dat iemand een bod voorbereidt
 * en waarvoor. Dat is precies de informatievoorsprong die dit project wil
 * afschaffen, dus het concept blijft in de browser van de bieder.
 *
 * Gevolg dat we eerlijk moeten benoemen aan de bieder: op een ander apparaat of
 * na het wissen van browsergegevens is het concept weg. Een concept is dan ook
 * geen bod: het staat niet in het logboek en telt nergens mee tot het verzegeld
 * verstuurd is.
 */

const PREFIX = "openbod_concept_";

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

function key(listingId: string): string {
  return `${PREFIX}${listingId}`;
}

export function saveConcept(listingId: string, concept: Omit<Concept, "savedAt">): Concept {
  const stored: Concept = { ...concept, savedAt: new Date().toISOString() };
  localStorage.setItem(key(listingId), JSON.stringify(stored));
  return stored;
}

export function loadConcept(listingId: string): Concept | null {
  const raw = localStorage.getItem(key(listingId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Concept;
  } catch {
    // Een onleesbaar concept is nutteloos en mag geen pagina breken.
    localStorage.removeItem(key(listingId));
    return null;
  }
}

export function clearConcept(listingId: string) {
  localStorage.removeItem(key(listingId));
}

/**
 * Alle concepten wissen. Nodig bij uitloggen: op een gedeeld apparaat hoort de
 * volgende gebruiker jouw halve bod niet te zien staan.
 */
export function clearAllConcepten() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}
