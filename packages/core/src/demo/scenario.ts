import { sealBid } from "../commit/seal.js";
import type { CreateListingInput, OpenBodStore } from "../store.js";
import type { BidPayload } from "../model/types.js";

/**
 * Het demoscenario: een instantie die zichzelf elk half uur terugzet.
 *
 * Een bezoeker komt op een willekeurig moment binnen en moet dan alle fasen
 * kunnen zien zonder een half uur te wachten. Daarom staan er altijd meerdere
 * woningen tegelijk open, elk in een andere fase: eentje waar nog uren op
 * geboden kan worden, eentje die tijdens het bezoek dichtgaat en voor je ogen
 * onthult, eentje waarvan de uitslag al bekend is, en eentje die buiten de
 * procedure om is afgehandeld. Na dertig minuten begint alles opnieuw, zodat de
 * demo niet volloopt met achtergelaten biedingen.
 *
 * Dit is de enige plek waar de core zelf biedingen verzegelt. In een echte
 * instantie gebeurt dat uitsluitend bij de bieder in de browser: zou de server
 * het doen, dan kent zij de bedragen en is de hele garantie weg. Hier simuleert
 * de seeder de bieders, en daarom laadt deze module alleen als de instantie
 * expliciet als demo draait. Een productie-instantie start hem nooit.
 */

const CYCLUS_MS = 30 * 60_000;

/** Een deelnemer in het scenario. De sub is pseudoniem, net als bij echte bieders. */
interface DemoBod {
  sub: string;
  payload: BidPayload;
}

export interface DemoStatus {
  actief: true;
  /** Wanneer de huidige ronde begon. */
  gestartOp: string;
  /** Wanneer alles wordt teruggezet. */
  resetOp: string;
  cyclusMinuten: number;
}

let gestartOp = new Date();

export function demoStatus(): DemoStatus {
  return {
    actief: true,
    gestartOp: gestartOp.toISOString(),
    resetOp: new Date(gestartOp.getTime() + CYCLUS_MS).toISOString(),
    cyclusMinuten: CYCLUS_MS / 60_000,
  };
}

function overMinuten(minuten: number): string {
  return new Date(Date.now() + minuten * 60_000).toISOString();
}

function bod(sub: string, amount: number, payload: Partial<BidPayload> = {}): DemoBod {
  return {
    sub,
    payload: { amount, conditions: [], takeover: [], ...payload },
  };
}

/**
 * De woningen van het scenario. De adressen zijn verzonnen en de omschrijving
 * zegt dat er niets te koop staat: een bezoeker mag geen moment denken dat hij
 * op een echt huis biedt.
 */
function scenario(): { listing: CreateListingInput; biedingen: DemoBod[]; afloop?: "gunnen" | "afbreken" }[] {
  const demoNoot = "Dit is een demonstratie. Deze woning bestaat niet en staat nergens te koop.";
  return [
    {
      listing: {
        address: "Kastanjelaan 12, Zwolle",
        prijsVorm: "vraagprijs",
        askingPrice: 425_000,
        verkoopmethode: "bieden_met_deadline",
        deadline: overMinuten(26),
        rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
        takeoverItems: [
          { label: "Zonwering achterzijde", status: "gevraagd_bedrag", amount: 450 },
          { label: "Tuinhuis", status: "in_overleg" },
          { label: "Vaatwasser", status: "blijft_achter" },
        ],
        omschrijving: `Jaren-dertig woning met een diepe tuin op het zuiden. ${demoNoot} Op deze woning kun je zelf een bod uitbrengen; de sluitingstijd ligt aan het eind van deze demoronde.`,
        kenmerken: { woonoppervlak: 118, perceeloppervlak: 240, kamers: 5, slaapkamers: 3, bouwjaar: 1932, energielabel: "C" },
      },
      biedingen: [
        bod("demo-bieder-anna", 431_000, { conditions: [{ type: "financieel" }] }),
        bod("demo-bieder-joris", 428_500),
      ],
    },
    {
      listing: {
        address: "Havenstraat 8, Deventer",
        prijsVorm: "richtprijs",
        askingPrice: 315_000,
        verkoopmethode: "inschrijving",
        deadline: overMinuten(8),
        rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
        takeoverItems: [{ label: "Keukenapparatuur", status: "gevraagd_bedrag", amount: 1_200 }],
        omschrijving: `Hoekwoning aan het water, kort bij het centrum. ${demoNoot} De sluitingstijd is over een paar minuten: blijf kijken, dan zie je de biedingen vanzelf opengaan.`,
        kenmerken: { woonoppervlak: 94, perceeloppervlak: 165, kamers: 4, slaapkamers: 3, bouwjaar: 1968, energielabel: "D" },
      },
      biedingen: [
        bod("demo-bieder-samira", 322_000),
        bod("demo-bieder-tom", 318_000, { conditions: [{ type: "bouwkundige_keuring" }] }),
        bod("demo-bieder-ines", 329_500, { conditions: [{ type: "financieel" }, { type: "nhg" }] }),
        bod("demo-bieder-peter", 315_000),
      ],
    },
    {
      listing: {
        address: "Molenweg 3, Apeldoorn",
        prijsVorm: "vraagprijs",
        askingPrice: 549_000,
        verkoopmethode: "inschrijving",
        deadline: overMinuten(1.5),
        rules: { intrekkenToegestaan: false, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
        takeoverItems: [{ label: "Zonnepanelen", status: "blijft_achter" }],
        omschrijving: `Vrijstaande woning aan de bosrand. ${demoNoot} Deze inschrijving is al gesloten: hier zie je de uitslag, het volledige logboek en aan wie er gegund is.`,
        kenmerken: { woonoppervlak: 156, perceeloppervlak: 620, kamers: 6, slaapkamers: 4, bouwjaar: 1994, energielabel: "A" },
      },
      biedingen: [
        bod("demo-bieder-hakim", 561_000, { motivation: "Wij wonen al in de wijk en onze kinderen zitten hier op school." }),
        bod("demo-bieder-lotte", 555_000, { conditions: [{ type: "verkoop_eigen_woning" }] }),
        bod("demo-bieder-daan", 572_000, { conditions: [{ type: "financieel" }] }),
      ],
      afloop: "gunnen",
    },
    {
      listing: {
        address: "Bakkerstraat 21, Nijmegen",
        prijsVorm: "bieden_vanaf",
        askingPrice: 289_000,
        verkoopmethode: "bieden_met_deadline",
        deadline: overMinuten(22),
        rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
        takeoverItems: [],
        omschrijving: `Bovenwoning in de binnenstad. ${demoNoot} Deze verkoop is buiten de inschrijving om afgehandeld: de biedingen zijn nooit geopend, en dát is hier precies het bewijs dat de bieders in handen hebben.`,
        kenmerken: { woonoppervlak: 72, kamers: 3, slaapkamers: 2, bouwjaar: 1901, energielabel: "F" },
      },
      biedingen: [bod("demo-bieder-eva", 295_000), bod("demo-bieder-mo", 291_500)],
      afloop: "afbreken",
    },
    {
      listing: {
        address: "De Wiel 44, Leeuwarden",
        prijsVorm: "vraagprijs",
        askingPrice: 379_000,
        verkoopmethode: "inschrijving",
        deadline: overMinuten(19),
        rules: { intrekkenToegestaan: false, aanpassenToegestaan: false, aantalBiedingenZichtbaar: false },
        takeoverItems: [{ label: "Gordijnen", status: "in_overleg" }],
        omschrijving: `Twee-onder-een-kap met garage. ${demoNoot} Hier gelden strengere spelregels: aanpassen en intrekken mag niet en het aantal biedingen is niet zichtbaar. Dat stond vooraf vast en geldt voor iedereen gelijk. Bieden kan.`,
        kenmerken: { woonoppervlak: 128, perceeloppervlak: 310, kamers: 5, slaapkamers: 4, bouwjaar: 2004, energielabel: "B" },
      },
      biedingen: [bod("demo-bieder-wouter", 384_000)],
    },
  ];
}

/** Wacht tot een woning de gevraagde status heeft, of geef op. */
async function wachtOpStatus(store: OpenBodStore, id: string, status: string, maxMs = 120_000): Promise<boolean> {
  const eind = Date.now() + maxMs;
  while (Date.now() < eind) {
    try {
      if (store.getListing(id).status === status) return true;
    } catch {
      // De ronde is opnieuw begonnen en deze woning bestaat niet meer.
      return false;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function seed(store: OpenBodStore): Promise<void> {
  for (const { listing, biedingen, afloop } of scenario()) {
    const aangemaakt = store.createListing(listing);
    for (const { sub, payload } of biedingen) {
      // Verzegelen met dezelfde functie die de browser van een echte bieder
      // gebruikt, zodat de demo geen makkelijker pad neemt dan de werkelijkheid.
      const { commitment, ciphertext } = await sealBid(payload, aangemaakt.deadline);
      store.placeBid(aangemaakt.id, sub, commitment, ciphertext);
    }

    if (afloop === "afbreken") {
      store.abortListing(
        aangemaakt.id,
        "De verkoper heeft de woning onderhands verkocht aan een bekende en trekt de inschrijving in.",
      );
    }

    if (afloop === "gunnen") {
      // De scheduler sluit en onthult vanzelf zodra de deadline verstrijkt; dit
      // wacht daarop en gunt dan aan het hoogste geldige bod, zoals een verkoper
      // dat zou doen.
      void (async () => {
        if (!(await wachtOpStatus(store, aangemaakt.id, "onthuld"))) {
          console.warn(`[demo] ${aangemaakt.address} is niet op tijd onthuld; niet gegund`);
          return;
        }
        try {
          const logboek = store.getLogbook(aangemaakt.id);
          const beste = [...logboek.entries].filter((e) => e.valid).sort((a, b) => b.amount - a.amount)[0];
          if (beste) store.awardListing(aangemaakt.id, beste.bidId);
        } catch (err) {
          console.warn(`[demo] gunnen van ${aangemaakt.address} overgeslagen`, err);
        }
      })();
    }
  }
  console.log(`[demo] scenario klaargezet, volgende reset om ${demoStatus().resetOp}`);
}

/**
 * Start de demo-instantie: nu seeden, en daarna elk half uur alles terugzetten.
 */
export function startDemo(store: OpenBodStore): void {
  gestartOp = new Date();
  void seed(store);
  setInterval(() => {
    gestartOp = new Date();
    store.clear();
    console.log("[demo] alles teruggezet, scenario begint opnieuw");
    void seed(store);
  }, CYCLUS_MS);
}
