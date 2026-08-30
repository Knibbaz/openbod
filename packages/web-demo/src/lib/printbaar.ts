import type { Listing, Logbook, MyBid } from "./api";

/**
 * Een printbare versie van het ontvangstbewijs en van het biedlogboek.
 *
 * De JSON-download blijft bestaan, want daar rekent de verifier mee. Maar een
 * bestand met hashes erin is voor de meeste mensen geen bewijsstuk maar een
 * raadsel, en een deel van de kopers en verkopers hier is boven de 65 en bewaart
 * papier. Vandaar dit: dezelfde gegevens, met eronder in gewone taal wat er
 * bewaard is, hoe het ontsleuteld wordt en hoe iemand het kan narekenen.
 *
 * Geen PDF-bibliotheek: dit opent een venster met kant-en-klare HTML en laat de
 * browser printen. "Opslaan als PDF" zit in elk printvenster, dus je krijgt
 * dezelfde uitkomst zonder de bundel zwaarder te maken.
 */

function esc(waarde: unknown): string {
  return String(waarde ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function datum(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "full", timeStyle: "medium" });
}

function euro(bedrag: number): string {
  return `€ ${bedrag.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STIJL = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.5; color: #111; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2mm; }
  h2 { font-size: 11.5pt; margin: 7mm 0 2mm; border-bottom: 1px solid #bbb; padding-bottom: 1mm; }
  .kop { border-bottom: 2px solid #111; padding-bottom: 3mm; margin-bottom: 5mm; }
  .sub { color: #444; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  th, td { text-align: left; vertical-align: top; padding: 1.4mm 0; font-size: 10pt; }
  th { width: 42mm; font-weight: normal; color: #444; padding-right: 4mm; }
  .hash { font-family: "DejaVu Sans Mono", Menlo, Consolas, monospace; font-size: 8.5pt; word-break: break-all; }
  .uitleg p { margin: 0 0 2.5mm; }
  .uitleg ol { margin: 0 0 2.5mm; padding-left: 5mm; }
  .uitleg li { margin-bottom: 1.5mm; }
  .let-op { border-left: 3px solid #111; padding: 2mm 0 2mm 4mm; margin: 3mm 0; }
  .voet { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #bbb; color: #444; font-size: 8.5pt; }
  .log th { width: auto; }
  .log td, .log th { border-bottom: 1px solid #e0e0e0; padding: 1.2mm 2mm 1.2mm 0; }
  @media print { .geenprint { display: none; } }
`;

function open(titel: string, body: string) {
  const venster = window.open("", "_blank");
  if (!venster) {
    alert("Je browser blokkeerde het printvenster. Sta pop-ups toe voor deze pagina en probeer het opnieuw.");
    return;
  }
  venster.document.write(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc(titel)}</title>` +
      `<style>${STIJL}</style></head><body>${body}` +
      `<p class="geenprint"><button onclick="window.print()">Printen of opslaan als PDF</button></p>` +
      `</body></html>`,
  );
  venster.document.close();
  venster.focus();
  // Even wachten tot de opmaak staat, anders print Safari een lege pagina.
  setTimeout(() => venster.print(), 300);
}

/** De uitleg die op beide documenten hoort: opslag, ontsleuteling, controle. */
function uitleg(deadline: string): string {
  return `
  <h2>Wat hier bewaard is, en hoe het werkt</h2>
  <div class="uitleg">
    <p>
      Dit document is geen belofte van de website. Het is een bewijsstuk dat u zelf, of iemand
      namens u, kan narekenen zonder die website nog te hoeven vertrouwen.
    </p>

    <h2>Hoe het bod is opgeslagen</h2>
    <p>
      Uw bod is in uw eigen browser op twee manieren vastgelegd voordat er iets verstuurd werd.
    </p>
    <ol>
      <li>
        <strong>Een vingerafdruk (de commitment).</strong> Uit het volledige bod, samen met een
        willekeurig getal, is een code van 64 tekens berekend. Uit die code valt het bod niet terug
        te rekenen, maar bij het bod hoort maar één zo'n code. Wie het bedrag achteraf verandert,
        krijgt een andere code, en dat valt op.
      </li>
      <li>
        <strong>Een versleutelde kopie.</strong> Het bod zelf is versleuteld met een sleutel die op
        het moment van versturen nog niet bestond. Die sleutel wordt pas gemaakt op
        ${esc(datum(deadline))}, door een openbare, onafhankelijke dienst waar deze website geen
        zeggenschap over heeft (het drand-netwerk).
      </li>
    </ol>
    <p>
      De gevolgen daarvan: tot de sluitingstijd kon niemand uw bod lezen. Niet de makelaar, niet de
      verkoper, en ook niet degene die deze website beheert. Niet omdat zij dat beloofden, maar
      omdat de sleutel nog niet bestond.
    </p>

    <h2>Hoe het ontsleuteld wordt</h2>
    <p>
      Op de sluitingstijd geeft het drand-netwerk de sleutel vrij aan iedereen. Alle biedingen gaan
      dan tegelijk open. De website controleert bij elk geopend bod of het overeenkomt met de
      vingerafdruk die er al stond. Klopt dat niet, dan wordt het bod als ongeldig gemarkeerd en
      staat dat in het logboek.
    </p>
    <p>
      Uw naam zit hier niet bij. Die is apart versleuteld naar de verkoper en is alleen leesbaar
      voor wie diens sleutel heeft, en pas nadat er aan u gegund is.
    </p>

    <h2>Hoe u het kunt laten controleren</h2>
    <p>
      Bewaar naast dit papier ook het JSON-bestand van deze pagina. Daarmee kan iemand met een
      computer het volgende narekenen, zonder toegang tot de website:
    </p>
    <ol>
      <li>Dat de handtekening onderaan echt van deze instantie komt.</li>
      <li>Dat de logregels een ononderbroken keten vormen, waarin elke regel de vingerafdruk van de vorige draagt. Eén gewijzigde, ingevoegde of verwijderde regel breekt die keten.</li>
      <li>Dat uw eigen bod op de plek in die keten staat die op dit papier vermeld is.</li>
    </ol>
    <p>
      Het gereedschap daarvoor is vrij beschikbaar en van niemand in het proces:
      <span class="hash">github.com/Knibbaz/openbod</span>, onderdeel <span class="hash">verifier</span>.
      Een adviseur, een notaris of een handige kennis kan dit in enkele minuten doen.
    </p>

    <div class="let-op">
      <strong>Bewaar dit tot de verkoop is afgerond.</strong> Zonder dit document en het
      bijbehorende bestand kunt u achteraf niet aantonen dat uw bod meetelde, en daar draait deze
      manier van bieden om.
    </div>
  </div>`;
}

export function printOntvangstbewijs(listing: Listing, bod: MyBid) {
  const body = `
  <div class="kop">
    <h1>Ontvangstbewijs van uw bod</h1>
    <div class="sub">${esc(listing.address)}</div>
  </div>

  <h2>Uw bod</h2>
  <table>
    <tr><th>Ontvangen op</th><td>${esc(datum(bod.timestamp))}</td></tr>
    <tr><th>Sluitingstijd</th><td>${esc(datum(listing.deadline))}</td></tr>
    <tr><th>Versie van uw bod</th><td>${esc(bod.version)}</td></tr>
    <tr><th>Plek in het logboek</th><td>regel ${esc(bod.logIndex)}</td></tr>
  </table>

  <h2>De codes waarmee dit na te rekenen is</h2>
  <table>
    <tr><th>Kenmerk van uw bod</th><td class="hash">${esc(bod.bidId)}</td></tr>
    <tr><th>Kenmerk van de woning</th><td class="hash">${esc(bod.listingId)}</td></tr>
    <tr><th>Vingerafdruk van uw bod</th><td class="hash">${esc(bod.commitment)}</td></tr>
    <tr><th>Woninggegevens</th><td class="hash">${esc(listing.dossierHash)}</td></tr>
    <tr><th>Vorige logregel</th><td class="hash">${esc(bod.prevHash)}</td></tr>
    <tr><th>Deze logregel</th><td class="hash">${esc(bod.entryHash)}</td></tr>
    <tr><th>Handtekening</th><td class="hash">${esc(bod.instanceSignature)}</td></tr>
  </table>
  <p class="sub">
    De regel "woninggegevens" hoort bij alles wat op het scherm stond toen u bood: de kenmerken, de
    omschrijving, de foto's, de lijst achterblijvende zaken en de spelregels. Verandert daar later
    iets aan, dan verandert deze code mee en is dat aantoonbaar.
  </p>

  ${uitleg(listing.deadline)}

  <div class="voet">
    Afgedrukt op ${esc(datum(new Date().toISOString()))} · ${esc(window.location.host)}
  </div>`;
  open(`Ontvangstbewijs ${listing.address}`, body);
}

export function printLogboek(listing: Listing, logboek: Logbook) {
  const geldig = logboek.entries.filter((e) => e.valid).sort((a, b) => b.amount - a.amount);
  const ongeldig = logboek.entries.filter((e) => !e.valid);

  const biedingen = geldig.length
    ? `<table class="log">
        <tr><th>Bieder</th><th>Bedrag</th><th>Oplevering</th><th>Voorbehouden</th></tr>
        ${geldig
          .map(
            (e) => `<tr>
              <td class="hash">${esc(e.bidderRef.slice(0, 12))}</td>
              <td>${esc(euro(e.amount))}${logboek.listing.awardedBidId === e.bidId ? " <strong>(gegund)</strong>" : ""}</td>
              <td>${e.handoverDate ? esc(new Date(e.handoverDate).toLocaleDateString("nl-NL")) : "-"}</td>
              <td>${e.conditions.length ? esc(e.conditions.map((v) => v.type).join(", ")) : "geen"}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : `<p>Er zijn geen geldige biedingen geopend.</p>`;

  const body = `
  <div class="kop">
    <h1>Biedlogboek</h1>
    <div class="sub">${esc(listing.address)}</div>
  </div>

  <h2>De procedure</h2>
  <table>
    <tr><th>Sluitingstijd</th><td>${esc(datum(logboek.listing.deadline))}</td></tr>
    <tr><th>Verkoopmethode</th><td>${esc(logboek.listing.verkoopmethode)}</td></tr>
    <tr><th>Eindstatus</th><td>${esc(logboek.listing.status)}</td></tr>
    ${
      logboek.listing.buitenProcedureReden
        ? `<tr><th>Reden van afhandeling buiten de procedure</th><td>${esc(logboek.listing.buitenProcedureReden)}</td></tr>`
        : ""
    }
    <tr><th>Aantal geopende biedingen</th><td>${esc(logboek.entries.length)}</td></tr>
    <tr><th>Logboek opgemaakt op</th><td>${esc(datum(logboek.generatedAt))}</td></tr>
  </table>

  <h2>De biedingen</h2>
  <p class="sub">
    Namen staan hier niet in en motivaties ook niet. Elke bieder heeft een eigen kenmerk, zodat u
    kunt zien dat het om verschillende personen ging zonder te weten wie.
  </p>
  ${biedingen}
  ${ongeldig.length ? `<p class="sub">${esc(ongeldig.length)} bieding(en) kwamen niet overeen met hun vingerafdruk en zijn als ongeldig vastgelegd.</p>` : ""}

  <h2>De gebeurtenissen, op volgorde</h2>
  <table class="log">
    <tr><th>#</th><th>Tijdstip</th><th>Wat er gebeurde</th></tr>
    ${logboek.log
      .map(
        (r) =>
          `<tr><td>${esc(r.index)}</td><td>${esc(new Date(r.timestamp).toLocaleString("nl-NL"))}</td><td>${esc(r.type)}</td></tr>`,
      )
      .join("")}
  </table>

  <h2>De codes waarmee dit na te rekenen is</h2>
  <table>
    <tr><th>Slotcode van de keten</th><td class="hash">${esc(logboek.rootHash)}</td></tr>
    <tr><th>Handtekening</th><td class="hash">${esc(logboek.signature)}</td></tr>
  </table>

  ${uitleg(logboek.listing.deadline)}

  <div class="voet">
    Afgedrukt op ${esc(datum(new Date().toISOString()))} · ${esc(window.location.host)}
  </div>`;
  open(`Biedlogboek ${listing.address}`, body);
}
