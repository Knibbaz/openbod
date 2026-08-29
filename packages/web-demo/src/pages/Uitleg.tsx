import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepContent from "@mui/material/StepContent";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import { Sectie } from "../components/Sectie";

const STAPPEN = [
  {
    titel: "Verzegelen, in jouw browser",
    bestand: "packages/web-demo/src/lib/seal.ts",
    tekst:
      "Je bod wordt versleuteld met een timelock naar het publieke drand quicknet-netwerk, gekoppeld aan de sluitingsronde. Dat gebeurt op je eigen apparaat, niet op de server.",
  },
  {
    titel: "Opslaan",
    bestand: "packages/core/src/store.ts",
    tekst:
      "De server ontvangt alleen een hash (de commitment) en de versleutelde inhoud. Het bedrag, de voorbehouden en je motivatie zijn op dat moment voor niemand leesbaar, ook niet voor de makelaar.",
  },
  {
    titel: "Onthullen op de deadline",
    bestand: "packages/core/src/reveal/reveal.ts",
    tekst:
      "Zodra drand de rondesleutel publiceert, kan iedereen ontsleutelen (ook deze server, pas op dat moment). Jij hoeft daarvoor niets te doen en niet online te zijn.",
  },
  {
    titel: "Onwrikbaar logboek",
    bestand: "packages/core/src/log/hashchain.ts",
    tekst:
      "Elke gebeurtenis staat in een hashketen, waarin elke regel de hash van de vorige bevat. Iets wijzigen, invoegen of weghalen breekt die keten op een zichtbare plek.",
  },
  {
    titel: "Zelf verifiëren",
    bestand: "packages/verifier",
    tekst:
      "Geloof dit niet op ons woord. De verifier is een losse CLI die het logboek en je ontvangstbewijs controleert zonder deze server te vertrouwen.",
  },
];

export function Uitleg() {
  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Hoe werkt de verzegeling?</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "60ch" }}>
          Vertrouwen hoort hier niet uit een belofte te komen maar uit iets wat je kunt narekenen. Deze vijf stappen
          zijn samen die controle.
        </Typography>
      </Stack>

      <Sectie titel="Van bod tot bewijs">
        <Stepper orientation="vertical" nonLinear activeStep={-1}>
          {STAPPEN.map((stap) => (
            <Step key={stap.titel} active expanded>
              <StepLabel>
                <Typography sx={{ fontWeight: 600 }}>{stap.titel}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "62ch" }}>
                  {stap.tekst}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <code>{stap.bestand}</code>
                </Typography>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Sectie>

      <Sectie
        titel="Wat dit niet oplost"
        toelichting="Een standaard die meer belooft dan zij afdwingt, is precies het probleem dat dit project wil oplossen. Daarom staat hier ook wat er niet in zit."
      >
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch" }}>
          De verkoper houdt zijn eigen sleutel de hele tijd, dus dat hij pas bij gunning naar de identiteit van een
          bieder kijkt, is een procedurele en gelogde afspraak, geen wiskundige garantie. Dat operator en makelaar die
          identiteit nooit kunnen lezen, is dat wel. En dit systeem verlaagt geen prijzen: het lost inzicht en
          eerlijkheid op, niet de schaarste die overbieden veroorzaakt.
        </Typography>
      </Sectie>

      <Typography variant="body2" color="text.secondary">
        Volledige spec: <code>spec/protocol.md</code>. Architectuur: <code>ARCHITECTURE.md</code>. Alles staat open op{" "}
        <Link href="https://github.com/Knibbaz/openbod" target="_blank" rel="noreferrer">
          GitHub
        </Link>
        .
      </Typography>
    </Stack>
  );
}
