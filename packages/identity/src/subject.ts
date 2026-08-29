import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Afleiding van het pseudonieme subject (`sub`) dat de core als enige
 * identiteitsgegeven te zien krijgt (protocol.md §7).
 *
 * Waarom HMAC en niet een kale hash. Een e-mailadres heeft veel te weinig
 * entropie voor `sha256(adres)`. Wie zo'n hash heeft plus een ledenlijst, een
 * gelekte adressenlijst of gewoon de gebruikelijke voornaam.achternaam-varianten,
 * rekent in seconden terug wie erachter zit. Dan zou "de core kent geen
 * e-mailadressen" een bewering zijn over wat er is opgeslagen, niet over wat
 * eruit af te leiden valt, en juist dat onderscheid is waar dit project andere
 * partijen op aanspreekt.
 *
 * Met een pepper die alleen deze backend heeft, is er zonder die pepper niets te
 * raden: de aanvaller kan wel adressen proberen, maar niet de bijbehorende sub
 * uitrekenen. Deterministisch blijft het wel, dus dezelfde gebruiker houdt zijn
 * sub over sessies heen, wat nodig is om biedingen aan een bieder te koppelen.
 *
 * De pepper is een geheim van de identiteitslaag en verlaat die nooit. Hij gaat
 * niet naar de core, niet in een token en niet in het logboek.
 */

const MIN_PEPPER_BYTES = 32;

export class WeakPepperError extends Error {}

/**
 * Leest de pepper uit de omgeving. Ontbreekt hij buiten productie, dan wordt er
 * een vluchtige gegenereerd, net als bij de instantiesleutel: de demo blijft
 * werken, maar subjects veranderen bij een herstart. In productie is dat geen
 * optie, want dan raakt elke gebruiker zijn eerdere biedingen kwijt.
 */
export function loadSubjectPepper(env = process.env): Buffer {
  const raw = env.IDENTITY_SUBJECT_PEPPER;
  const isProduction = env.NODE_ENV === "production";

  if (!raw) {
    if (isProduction) {
      throw new WeakPepperError(
        "IDENTITY_SUBJECT_PEPPER ontbreekt. Zonder pepper is een sub uit een e-mailadres te raden; " +
          "genereer er een met: openssl rand -hex 32",
      );
    }
    return randomBytes(MIN_PEPPER_BYTES);
  }

  const pepper = Buffer.from(raw, "utf8");
  if (pepper.length < MIN_PEPPER_BYTES) {
    throw new WeakPepperError(
      `IDENTITY_SUBJECT_PEPPER is te kort (${pepper.length} bytes, minimaal ${MIN_PEPPER_BYTES}). ` +
        "Een korte pepper is te brute-forcen en biedt dus geen bescherming.",
    );
  }
  return pepper;
}

/**
 * Normaliseert het adres voordat het de HMAC in gaat. Zonder normalisatie
 * levert "Alice@Example.nl" een andere sub op dan "alice@example.nl", en zou
 * dezelfde persoon twee identiteiten hebben en dus twee keer kunnen bieden.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `sub = HMAC-SHA256(pepper, genormaliseerd adres)`, als hex. */
export function deriveSubject(email: string, pepper: Buffer): string {
  return createHmac("sha256", pepper).update(normalizeEmail(email)).digest("hex");
}

/**
 * Constante-tijdvergelijking van twee subjects. Nergens strikt nodig in de
 * huidige flow, maar wel de juiste gewoonte zodra subjects ergens vergeleken
 * worden: een gewone stringvergelijking lekt via de looptijd hoeveel tekens
 * overeenkwamen.
 */
export function subjectsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
