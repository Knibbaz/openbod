import Chip from "@mui/material/Chip";
import type { ListingStatus } from "../lib/api";

/**
 * De fase van een woning in één label. Kleur draagt hier betekenis en wordt
 * niet decoratief ingezet: oranje betekent "verzegeld, nog niet leesbaar",
 * blauw "open en leesbaar", grijs "afgerond". Er is bewust geen groen, want
 * groen is in deze demo gereserveerd voor een geslaagde verificatie.
 */
const LABELS: Record<ListingStatus, { label: string; color: "default" | "warning" | "info" | "primary" }> = {
  aangemaakt: { label: "Aangemaakt", color: "default" },
  biedfase: { label: "Biedfase, verzegeld", color: "warning" },
  gesloten: { label: "Gesloten, wacht op onthulling", color: "warning" },
  onthuld: { label: "Onthuld", color: "info" },
  onherroepelijk: { label: "Gegund", color: "primary" },
  buiten_procedure: { label: "Buiten de procedure afgehandeld", color: "default" },
};

export function StatusChip({ status }: { status: ListingStatus }) {
  const { label, color } = LABELS[status] ?? { label: status, color: "default" as const };
  return <Chip size="small" color={color} variant="outlined" label={label} />;
}
