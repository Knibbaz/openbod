import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Kenmerken } from "../lib/api";

/** Eén feit over de woning. Leeg blijft leeg: liever niets dan een streepje. */
function Feit({ label, waarde }: { label: string; waarde?: string }) {
  if (!waarde) return null;
  return (
    <Stack sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{waarde}</Typography>
    </Stack>
  );
}

export function Kenmerkenblok({ kenmerken }: { kenmerken?: Kenmerken }) {
  if (!kenmerken) return null;
  const { woonoppervlak, perceeloppervlak, kamers, slaapkamers, bouwjaar, energielabel } = kenmerken;
  const leeg = [woonoppervlak, perceeloppervlak, kamers, slaapkamers, bouwjaar, energielabel].every(
    (v) => v === undefined,
  );
  if (leeg) return null;

  return (
    <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap", rowGap: 2 }}>
      <Feit label="Woonoppervlak" waarde={woonoppervlak ? `${woonoppervlak} m²` : undefined} />
      <Feit label="Perceel" waarde={perceeloppervlak ? `${perceeloppervlak} m²` : undefined} />
      <Feit label="Kamers" waarde={kamers ? String(kamers) : undefined} />
      <Feit label="Slaapkamers" waarde={slaapkamers !== undefined ? String(slaapkamers) : undefined} />
      <Feit label="Bouwjaar" waarde={bouwjaar ? String(bouwjaar) : undefined} />
      <Feit label="Energielabel" waarde={energielabel} />
    </Stack>
  );
}
