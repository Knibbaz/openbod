import type { OvernameStatus } from "./api";

/**
 * De gebruikelijke lijst van zaken, als startpunt.
 *
 * Waarom dit erin zit: een makelaar loopt deze lijst toch al af voor de
 * brochure, en het per woning opnieuw intypen levert precies de verschillen op
 * waar later ruzie over ontstaat. Belangrijker nog voor dit systeem: wat blijft
 * en wat ter overname is, hoort vóór de sluitingstijd vast te staan voor
 * iedereen, want het zit in de dossierhash. Een volledige lijst maakt zichtbaar
 * waar niets over gezegd is.
 *
 * De verkoper kan alles aanpassen of weggooien. Dit is een startpunt, geen
 * voorschrift, en het is bewust geen kopie van een lijst van een andere partij:
 * het zijn de zaken die in vrijwel elke woningbrochure langskomen.
 */
export interface Standaardzaak {
  label: string;
  status: OvernameStatus;
}

export interface Rubriek {
  titel: string;
  zaken: Standaardzaak[];
}

export const STANDAARDZAKEN: Rubriek[] = [
  {
    titel: "Woning algemeen",
    zaken: [
      { label: "Vloerbedekking en parket", status: "blijft_achter" },
      { label: "Vaste kasten", status: "blijft_achter" },
      { label: "Gordijnrails", status: "blijft_achter" },
      { label: "Gordijnen en vitrages", status: "in_overleg" },
      { label: "Rolluiken", status: "blijft_achter" },
      { label: "Zonwering buiten", status: "blijft_achter" },
      { label: "Horren", status: "blijft_achter" },
      { label: "Brievenbus", status: "blijft_achter" },
      { label: "Rookmelders", status: "blijft_achter" },
      { label: "Alarminstallatie", status: "in_overleg" },
      { label: "Veiligheidssloten", status: "blijft_achter" },
    ],
  },
  {
    titel: "Keuken",
    zaken: [
      { label: "Keukenblok met bovenkasten", status: "blijft_achter" },
      { label: "Kookplaat", status: "blijft_achter" },
      { label: "Afzuigkap", status: "blijft_achter" },
      { label: "Oven", status: "blijft_achter" },
      { label: "Magnetron", status: "in_overleg" },
      { label: "Koelkast", status: "in_overleg" },
      { label: "Vaatwasser", status: "in_overleg" },
      { label: "Losse keukenapparatuur", status: "niet_beschikbaar" },
    ],
  },
  {
    titel: "Sanitair",
    zaken: [
      { label: "Badkameraccessoires", status: "blijft_achter" },
      { label: "Toiletaccessoires", status: "blijft_achter" },
      { label: "Spiegel en planchet", status: "blijft_achter" },
    ],
  },
  {
    titel: "Verwarming en energie",
    zaken: [
      { label: "CV-installatie met toebehoren", status: "blijft_achter" },
      { label: "Thermostaat", status: "blijft_achter" },
      { label: "Boiler", status: "blijft_achter" },
      { label: "Mechanische ventilatie", status: "blijft_achter" },
      { label: "Zonnepanelen", status: "blijft_achter" },
      { label: "Warmtepomp", status: "blijft_achter" },
      { label: "Laadpaal", status: "in_overleg" },
    ],
  },
  {
    titel: "Tuin en buitenruimte",
    zaken: [
      { label: "Tuinaanleg en beplanting", status: "blijft_achter" },
      { label: "Tuinhuis of berging", status: "blijft_achter" },
      { label: "Buitenverlichting", status: "blijft_achter" },
      { label: "Buitenkraan", status: "blijft_achter" },
      { label: "Vijver", status: "blijft_achter" },
      { label: "Tuinmeubelen", status: "niet_beschikbaar" },
      { label: "Broeikas", status: "in_overleg" },
    ],
  },
];

/** Alle standaardzaken achter elkaar, in de volgorde van de rubrieken. */
export function alleStandaardzaken(): Standaardzaak[] {
  return STANDAARDZAKEN.flatMap((r) => r.zaken);
}
