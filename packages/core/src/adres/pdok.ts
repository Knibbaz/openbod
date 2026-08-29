/**
 * Adresgegevens uit open overheidsbronnen (E1-S4).
 *
 * Een makelaar hoort het woonoppervlak en het bouwjaar niet over te typen uit
 * een brochure van een ander. Die gegevens staan in de BAG van het Kadaster,
 * zijn vrij te gebruiken en door iedereen na te trekken. Dat past bij een
 * systeem dat niet om vertrouwen vraagt: staat er 118 m² in het dossier, dan
 * kan een bieder zelf bij de bron kijken of dat klopt.
 *
 * Twee bronnen, beide van PDOK en beide zonder sleutel of registratie:
 * - de locatieserver voor het zoeken en herkennen van een adres;
 * - de BAG OGC API voor de kenmerken van het verblijfsobject en het pand.
 *
 * Dit draait in de core en niet in de browser, om drie redenen: PDOK ziet dan
 * het adres van de instantie in plaats van dat van elke makelaar, de drie
 * verzoeken die één opzoeking kost worden hier tot één antwoord samengevoegd,
 * en de instantie kan zelf begrenzen hoeveel verkeer zij naar een gratis
 * publieke voorziening stuurt.
 *
 * Wat hier nadrukkelijk niet gebeurt: gegevens vastzetten. Wat teruggekomen is,
 * vult het formulier van de makelaar in, en hij kan alles corrigeren. De BAG
 * heeft het bij de les over bouwjaren en oppervlaktes vaker mis dan een
 * bewoner, en een dossier dat de werkelijkheid tegenspreekt helpt niemand.
 */

const LOCATIESERVER = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
const BAG = "https://api.pdok.nl/kadaster/bag/ogc/v2";
const TIMEOUT_MS = 5_000;

export interface AdresSuggestie {
  /** Id van de locatieserver, te gebruiken bij `haalAdresKenmerken`. */
  id: string;
  weergavenaam: string;
}

export interface AdresKenmerken {
  id: string;
  /** "Damrak 1, Amsterdam": zo hoort het adres in het dossier te staan. */
  adres: string;
  straat: string;
  huisnummer: string;
  postcode?: string;
  woonplaats: string;
  /** Gebruiksoppervlakte van het verblijfsobject in m², uit de BAG. */
  woonoppervlak?: number;
  /** Bouwjaar van het pand waarin het verblijfsobject ligt, uit de BAG. */
  bouwjaar?: number;
  /** Bijvoorbeeld "woonfunctie". Waarschuwt als hier iets anders staat. */
  gebruiksdoel?: string;
  /** Waar deze gegevens vandaan komen, zodat het narekenbaar is. */
  bron: string;
}

export class AdresBronError extends Error {}

async function haalJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new AdresBronError(`bron antwoordde ${res.status}`);
  return res.json();
}

/** Zoekt adressen op vrije tekst; bedoeld voor een suggestielijst tijdens typen. */
export async function zoekAdressen(vraag: string, max = 8): Promise<AdresSuggestie[]> {
  const url =
    `${LOCATIESERVER}/suggest?q=${encodeURIComponent(vraag)}` +
    `&rows=${max}&fq=${encodeURIComponent("type:adres")}`;
  const data = (await haalJson(url)) as { response?: { docs?: { id?: string; weergavenaam?: string }[] } };
  return (data.response?.docs ?? [])
    .filter((d): d is { id: string; weergavenaam: string } => Boolean(d.id && d.weergavenaam))
    .map((d) => ({ id: d.id, weergavenaam: d.weergavenaam }));
}

/**
 * Haalt alles op wat we van één adres kunnen weten: het adres zelf uit de
 * locatieserver, en daarna oppervlakte en bouwjaar uit de BAG. De BAG-stap mag
 * mislukken zonder dat de opzoeking waardeloos wordt: een adres zonder
 * oppervlakte is nog steeds een adres, en de makelaar vult de rest zelf in.
 */
export async function haalAdresKenmerken(id: string): Promise<AdresKenmerken> {
  const lookup = (await haalJson(
    `${LOCATIESERVER}/lookup?id=${encodeURIComponent(id)}&fl=${encodeURIComponent(
      "id,weergavenaam,straatnaam,huis_nlt,postcode,woonplaatsnaam,adresseerbaarobject_id",
    )}`,
  )) as { response?: { docs?: Record<string, unknown>[] } };
  const doc = lookup.response?.docs?.[0];
  if (!doc) throw new AdresBronError("adres niet gevonden");

  const straat = String(doc.straatnaam ?? "");
  const huisnummer = String(doc.huis_nlt ?? "");
  const woonplaats = String(doc.woonplaatsnaam ?? "");
  const kenmerken: AdresKenmerken = {
    id,
    // Niet de weergavenaam van de locatieserver, want daar zit de postcode in.
    // In het dossier staat het adres zoals een advertentie het schrijft.
    adres: `${straat} ${huisnummer}, ${woonplaats}`.trim(),
    straat,
    huisnummer,
    postcode: doc.postcode ? String(doc.postcode) : undefined,
    woonplaats,
    bron: "BAG (Kadaster), via PDOK",
  };

  const objectId = doc.adresseerbaarobject_id ? String(doc.adresseerbaarobject_id) : undefined;
  if (!objectId) return kenmerken;

  try {
    const vbo = (await haalJson(
      `${BAG}/collections/verblijfsobject/items?f=json&limit=1&identificatie=${encodeURIComponent(objectId)}`,
    )) as { features?: { properties?: Record<string, unknown> }[] };
    const props = vbo.features?.[0]?.properties;
    if (!props) return kenmerken;

    const oppervlakte = Number(props.oppervlakte);
    if (Number.isFinite(oppervlakte) && oppervlakte > 0) kenmerken.woonoppervlak = oppervlakte;
    if (typeof props.gebruiksdoel === "string") kenmerken.gebruiksdoel = props.gebruiksdoel;

    const pandHref = Array.isArray(props["pand.href"]) ? String(props["pand.href"][0]) : undefined;
    if (pandHref?.startsWith(BAG)) {
      const pand = (await haalJson(`${pandHref}?f=json`)) as { properties?: Record<string, unknown> };
      const bouwjaar = Number(pand.properties?.bouwjaar);
      if (Number.isFinite(bouwjaar) && bouwjaar > 1000) kenmerken.bouwjaar = bouwjaar;
    }
  } catch {
    // De BAG-stap is een aanvulling, geen voorwaarde.
  }

  return kenmerken;
}
