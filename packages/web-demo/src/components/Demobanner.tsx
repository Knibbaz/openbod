import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ScienceIcon from "@mui/icons-material/ScienceOutlined";
import { coreApi, type DemoStatus } from "../lib/api";

/**
 * De mededeling dat dit een demonstratie is.
 *
 * Die hoort er te staan zolang er verzonnen woningen in staan met verzonnen
 * biedingen: een bezoeker mag geen seconde denken dat hij op een echt huis
 * biedt. De instantie zegt zelf of zij als demo draait, dus een echte
 * instantie toont dit nooit, en niemand hoeft de tekst weg te halen bij het
 * in productie nemen.
 *
 * Wegklikken mag, want de volle tekst is na een keer lezen alleen nog in de
 * weg. Wat er dan overblijft is een smalle balk die twee dingen blijft zeggen:
 * dit is een demo, en over hoeveel minuten alles gewist wordt. Dat tweede is
 * geen sfeermelding maar een waarschuwing: wie zijn ontvangstbewijs niet
 * bewaart, is het straks kwijt. Daarom verdwijnt die regel nooit helemaal.
 */

const OPSLAG_SLEUTEL = "openbod_demo_ingeklapt";

function leesIngeklapt(): boolean {
  try {
    return localStorage.getItem(OPSLAG_SLEUTEL) === "1";
  } catch {
    // Privémodus of geblokkeerde opslag: dan staat de balk gewoon open.
    return false;
  }
}

function bewaarIngeklapt(ingeklapt: boolean) {
  try {
    if (ingeklapt) localStorage.setItem(OPSLAG_SLEUTEL, "1");
    else localStorage.removeItem(OPSLAG_SLEUTEL);
  } catch {
    // Niet kunnen onthouden is vervelend, geen reden om de pagina te breken.
  }
}

export function Demobanner() {
  const [status, setStatus] = useState<DemoStatus>({ actief: false });
  const [nu, setNu] = useState(() => Date.now());
  const [ingeklapt, setIngeklapt] = useState(leesIngeklapt);

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
  const minuten = `${resterendMin} ${resterendMin === 1 ? "minuut" : "minuten"}`;

  function klap(dicht: boolean) {
    setIngeklapt(dicht);
    bewaarIngeklapt(dicht);
  }

  if (ingeklapt) {
    return (
      <Alert
        severity="info"
        icon={<ScienceIcon fontSize="inherit" />}
        sx={{ borderRadius: 0, py: 0.25, alignItems: "center" }}
        action={
          <Button color="inherit" size="small" onClick={() => klap(false)}>
            Wat betekent dat?
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>Demonstratie</strong> · verzonnen woningen · alles wordt over {minuten} gewist
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert severity="info" sx={{ borderRadius: 0 }} onClose={() => klap(true)}>
      <AlertTitle>Dit is een demonstratie</AlertTitle>
      <Typography variant="body2">
        De woningen en de biedingen zijn verzonnen, de huizen bestaan niet en staan nergens te koop. Bieden kan wel
        echt: je bod wordt op dezelfde manier versleuteld als in een echte procedure en komt in hetzelfde logboek.
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        Over {minuten} begint alles opnieuw en verdwijnt alles wat hier nu staat, ook je eigen bod. Wil je iets
        bewaren, download dan je ontvangstbewijs of het logboek.
      </Typography>
    </Alert>
  );
}
