import type { OvernameStatus } from "./api";
import type { OvernameChoice, Voorbehoud } from "./seal";

/**
 * Labels en omrekeningen die zowel het biedformulier als de uitslagtabel nodig
 * hebben. Ze staan hier los omdat het formulier naar een afgeschermde module is
 * verhuisd (`components/Biedmodule.tsx`) en de uitslag op de pagina blijft; zie
 * E9-S5 in de backlog.
 */

export const VOORBEHOUD_LABELS: { type: Voorbehoud["type"]; label: string; uitleg: string }[] = [
  {
    type: "financieel",
    label: "Financieringsvoorbehoud",
    uitleg: "Je bod vervalt als je de hypotheek niet rond krijgt.",
  },
  { type: "bouwdepot", label: "Bouwdepot", uitleg: "Je hebt een hypotheek met bouwdepot nodig." },
  { type: "bouwkundige_keuring", label: "Bouwkundige keuring", uitleg: "Je bod hangt af van de uitkomst." },
  { type: "verkoop_eigen_woning", label: "Verkoop eigen woning", uitleg: "Je moet eerst je huidige woning verkopen." },
  { type: "nhg", label: "NHG", uitleg: "Je hebt Nationale Hypotheek Garantie nodig." },
  { type: "anders", label: "Anders", uitleg: "Licht hieronder toe wat je bedoelt." },
];

export const STATUS_LABELS: Record<OvernameStatus, string> = {
  blijft_achter: "Blijft achter",
  gevraagd_bedrag: "Ter overname",
  in_overleg: "Ter overname, in overleg",
  niet_beschikbaar: "Niet beschikbaar",
};

export const CHOICE_LABELS: Record<OvernameChoice["choice"], string> = {
  geen: "Geen interesse",
  gevraagd_bedrag: "Overnemen voor het gevraagde bedrag",
  eigen_bod: "Eigen bod",
  in_overleg: "In overleg",
};

export function choicesFor(status: OvernameStatus): OvernameChoice["choice"][] {
  if (status === "gevraagd_bedrag") return ["geen", "gevraagd_bedrag", "eigen_bod", "in_overleg"];
  if (status === "in_overleg") return ["geen", "eigen_bod", "in_overleg"];
  return [];
}

/** Een `<input type="date">` levert YYYY-MM-DD; het biedschema wil RFC3339. */
export function dateToIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

export function isoToDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString("nl-NL") : "-";
}

export function euro(bedrag: number): string {
  return `€ ${bedrag.toLocaleString("nl-NL")}`;
}
