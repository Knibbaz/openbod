import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";
import { coreApi, type DemoStatus } from "../lib/api";

/**
 * De mededeling dat dit een demonstratie is.
 *
 * Die hoort er te staan zolang er verzonnen woningen in staan met verzonnen
 * biedingen: een bezoeker mag geen seconde denken dat hij op een echt huis
 * biedt. De instantie zegt zelf of zij als demo draait, dus een echte
 * instantie toont dit nooit, en niemand hoeft de tekst weg te halen bij het
 * in productie nemen.
 */
export function Demobanner() {
  const [status, setStatus] = useState<DemoStatus>({ actief: false });
  const [nu, setNu] = useState(() => Date.now());

  useEffect(() => {
    coreApi.getDemoStatus().then(setStatus).catch(() => {});
    // Blijft doorlopen zodat de nieuwe ronde na een reset vanzelf in beeld komt.
    const t = setInterval(() => {
      setNu(Date.now());
      coreApi.getDemoStatus().then(setStatus).catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!status.actief) return null;

  const resterendMin = Math.max(0, Math.round((new Date(status.resetOp).getTime() - nu) / 60_000));

  return (
    <Alert severity="info" sx={{ borderRadius: 0 }}>
      <AlertTitle>Dit is een demonstratie</AlertTitle>
      <Typography variant="body2">
        De woningen en de biedingen zijn verzonnen, de huizen bestaan niet en staan nergens te koop. Bieden kan wel
        echt: je bod wordt op dezelfde manier versleuteld als in een echte procedure en komt in hetzelfde logboek.
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        Over {resterendMin} {resterendMin === 1 ? "minuut" : "minuten"} begint alles opnieuw en verdwijnt alles wat
        hier nu staat, ook je eigen bod. Wil je iets bewaren, download dan je ontvangstbewijs of het logboek.
      </Typography>
    </Alert>
  );
}
