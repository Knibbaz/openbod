import { describe, it, expect } from "vitest";
import { OpenBodStore, computeDossierHash, sha256Hex, canonicalize } from "../../src/index.js";

/**
 * I15: waarop er geboden werd, ligt net zo vast als dát er geboden werd.
 *
 * Een bod is een reactie op een advertentie. Een logboek dat alleen bedragen
 * vastlegt, laat een stille wijziging van het woonoppervlak of van de lijst
 * achterblijvende zaken volledig ongemoeid, terwijl dat precies de vergelijking
 * is waar de verkoper straks op afgaat.
 */

const BASIS = {
  address: "Voorbeeldstraat 1, Amsterdam",
  prijsVorm: "vraagprijs" as const,
  askingPrice: 500000,
  verkoopmethode: "inschrijving" as const,
  rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
  takeoverItems: [],
};

function maak(store: OpenBodStore, extra: Record<string, unknown> = {}) {
  return store.createListing({
    ...BASIS,
    deadline: new Date(Date.now() + 60_000).toISOString(),
    ...extra,
  });
}

describe("Dossierhash (I15)", () => {
  it("is publiek en zelf na te rekenen uit wat de bieder te zien kreeg", () => {
    const store = new OpenBodStore();
    const listing = maak(store, {
      omschrijving: "Ruime hoekwoning met tuin op het zuiden.",
      kenmerken: { woonoppervlak: 124, bouwjaar: 1998, energielabel: "B" as const },
      fotos: ["https://voorbeeld.nl/1.jpg"],
    });

    // Iedereen met de publieke gegevens komt op dezelfde hash uit. Dat is de
    // hele werking: je hoeft de instantie niet te geloven, je rekent het na.
    const zelfBerekend = computeDossierHash({
      address: listing.address,
      prijsVorm: listing.prijsVorm,
      askingPrice: listing.askingPrice,
      verkoopmethode: listing.verkoopmethode,
      deadline: listing.deadline,
      rules: listing.rules,
      takeoverItems: listing.takeoverItems,
      fotos: listing.fotos,
      omschrijving: listing.omschrijving,
      kenmerken: listing.kenmerken,
    });
    expect(zelfBerekend).toBe(listing.dossierHash);
  });

  it("zit in de listing_opened-regel, dus in de keten", () => {
    const store = new OpenBodStore();
    const listing = maak(store, { kenmerken: { woonoppervlak: 124 } });
    const eerste = store.getLog(listing.id)[0];

    expect(eerste.type).toBe("listing_opened");
    expect(eerste.payloadHash).toBe(
      sha256Hex(canonicalize({ id: listing.id, deadline: listing.deadline, dossierHash: listing.dossierHash })),
    );
  });

  it("(beveiliging) verandert zodra er iets aan het dossier verandert", () => {
    const store = new OpenBodStore();
    const deadline = new Date(Date.now() + 60_000).toISOString();
    const basis = maak(store, { deadline, kenmerken: { woonoppervlak: 124 } });

    // Elk van deze wijzigingen hoort een andere hash op te leveren. Zou dat niet
    // zo zijn, dan kan een makelaar het dossier bijstellen zonder spoor.
    const varianten = [
      { kenmerken: { woonoppervlak: 140 } },
      { omschrijving: "Toch iets anders" },
      { fotos: ["https://voorbeeld.nl/andere.jpg"] },
      { askingPrice: 525000 },
      { takeoverItems: [{ label: "Tuinset", status: "blijft_achter" as const }] },
      { rules: { intrekkenToegestaan: false, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true } },
    ];

    for (const variant of varianten) {
      const andere = maak(store, { deadline, kenmerken: { woonoppervlak: 124 }, ...variant });
      expect(andere.dossierHash).not.toBe(basis.dossierHash);
    }
  });

  it("is stabiel: dezelfde inhoud levert dezelfde hash, ongeacht volgorde van invoeren", () => {
    const store = new OpenBodStore();
    const deadline = new Date(Date.now() + 60_000).toISOString();
    const kenmerken = { bouwjaar: 1998, woonoppervlak: 124, energielabel: "B" as const };
    const andersGeordend = { woonoppervlak: 124, energielabel: "B" as const, bouwjaar: 1998 };

    expect(maak(store, { deadline, kenmerken }).dossierHash).toBe(
      maak(store, { deadline, kenmerken: andersGeordend }).dossierHash,
    );
  });
});
