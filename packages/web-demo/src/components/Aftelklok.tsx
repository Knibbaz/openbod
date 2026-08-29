import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

/**
 * Hoeveel tijd heb ik nog. In een verzegelde inschrijving is dat de enige vraag
 * die er tijdens de biedfase toe doet, en een tijdstempel beantwoordt haar niet:
 * "sluit 14:00" dwingt de bezoeker tot hoofdrekenen op het moment dat hij het
 * minst helder denkt.
 *
 * De laatste minuten kleuren mee, want dan verandert de betekenis: doorgaan met
 * nadenken kost dan je kans om nog te bieden.
 */
function restant(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    dagen: Math.floor(ms / 86_400_000),
    uren: Math.floor(ms / 3_600_000) % 24,
    minuten: Math.floor(ms / 60_000) % 60,
    seconden: Math.floor(ms / 1000) % 60,
    urgent: ms < 15 * 60_000,
  };
}

function Vak({ waarde, eenheid, urgent }: { waarde: number; eenheid: string; urgent: boolean }) {
  return (
    <Stack sx={{ alignItems: "center", minWidth: 56 }}>
      <Typography
        sx={{
          fontSize: "1.75rem",
          fontWeight: 700,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
          color: urgent ? "warning.main" : "text.primary",
        }}
      >
        {String(waarde).padStart(2, "0")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {eenheid}
      </Typography>
    </Stack>
  );
}

export function Aftelklok({ deadline }: { deadline: string }) {
  const [rest, setRest] = useState(() => restant(deadline));

  useEffect(() => {
    const t = setInterval(() => setRest(restant(deadline)), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (!rest) {
    return (
      <Typography color="text.secondary">
        De inschrijving is gesloten op {new Date(deadline).toLocaleString("nl-NL")}.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {rest.urgent ? "Bijna gesloten" : "Je kunt nog bieden tot"}{" "}
        {new Date(deadline).toLocaleString("nl-NL", { dateStyle: "full", timeStyle: "short" })}
      </Typography>
      <Stack direction="row" spacing={2}>
        {rest.dagen > 0 && <Vak waarde={rest.dagen} eenheid={rest.dagen === 1 ? "dag" : "dagen"} urgent={rest.urgent} />}
        <Vak waarde={rest.uren} eenheid="uur" urgent={rest.urgent} />
        <Vak waarde={rest.minuten} eenheid="min" urgent={rest.urgent} />
        <Vak waarde={rest.seconden} eenheid="sec" urgent={rest.urgent} />
      </Stack>
    </Box>
  );
}
