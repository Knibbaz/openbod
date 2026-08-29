import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";

/**
 * Draait deze pagina in een context waar de browser zijn cryptografie aanbiedt?
 *
 * Alles wat dit systeem belooft, gebeurt in de browser van de bieder: het bod
 * verzegelen, de identiteit versleutelen naar de verkoper, de hashketen zelf
 * narekenen. Dat loopt allemaal via Web Crypto, en browsers geven `crypto.subtle`
 * alleen vrij in een beveiligde context: https, of localhost tijdens het
 * ontwikkelen. Op een instantie die over http bereikbaar is, bestaat die
 * functionaliteit domweg niet.
 *
 * Zonder deze controle merkt een bezoeker dat pas als hij op "bod versleuteld
 * versturen" drukt en er een onbegrijpelijke fout verschijnt. Dat is precies het
 * verkeerde moment, en voor een systeem dat om vertrouwen vraagt de verkeerde
 * eerste indruk.
 */
export function isVeiligeContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof crypto?.subtle !== "undefined";
}

export function Onveiligebanner() {
  if (isVeiligeContext()) return null;

  return (
    <Alert severity="error" sx={{ borderRadius: 0 }}>
      <AlertTitle>Deze instantie draait zonder https, en dan werkt het bieden niet</AlertTitle>
      <Typography variant="body2">
        Je browser geeft zijn cryptografie alleen vrij op een beveiligde verbinding. Verzegelen, je naam versleutelen
        naar de verkoper en het logboek zelf narekenen kunnen hier dus geen van drieën, en dat is nu juist alles wat
        dit systeem doet. Rondkijken kan wel.
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        Beheer je deze instantie? Zet er een certificaat voor en laat <code>PUBLIC_URL</code> op de https-URL wijzen.
      </Typography>
    </Alert>
  );
}
