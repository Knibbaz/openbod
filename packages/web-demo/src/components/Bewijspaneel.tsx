import { useState, type ReactNode } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMoreOutlined";
import ShieldIcon from "@mui/icons-material/ShieldOutlined";
import type { Listing, Logbook, MyBid } from "../lib/api";
import { verifyHashChainInBrowser } from "../lib/verify";

/**
 * Al het technische bewijs op één plek, dichtgeklapt.
 *
 * De vorige versie zette `bidId`, `entryHash` en `logregel #7` midden in de
 * biedstroom. Dat is precies verkeerd om: een koper die een bod van drie ton
 * uitbrengt, wil weten óf het goed staat, niet welke hash erbij hoort. Maar het
 * weglaten kan ook niet, want dan is dit systeem net zo'n black box als de rest.
 *
 * Dus: in gewone taal wat het betekent, en het narekenbare bewijs eronder voor
 * wie het wil zien. Dichtgeklapt is niet verstopt.
 */
function Rij({ kop, children }: { kop: string; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={{ width: "35%", verticalAlign: "top", border: 0, pl: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {kop}
        </Typography>
      </TableCell>
      <TableCell sx={{ border: 0 }}>{children}</TableCell>
    </TableRow>
  );
}

export function Bewijspaneel({
  listing,
  myBid,
  logbook,
}: {
  listing: Listing;
  myBid?: MyBid | null;
  logbook?: Logbook | null;
}) {
  const [chainCheck, setChainCheck] = useState<{ valid: boolean; firstBrokenIndex?: number } | null>(null);

  async function controleer() {
    if (!logbook) return;
    setChainCheck(await verifyHashChainInBrowser(logbook.log));
  }

  function download() {
    if (!logbook) return;
    const blob = new Blob([JSON.stringify(logbook, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logboek-${listing.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <ShieldIcon fontSize="small" color="primary" />
          <Typography sx={{ fontWeight: 600 }}>Bewijs en controle</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Alles wat je hieronder ziet, kun je zelf narekenen zonder deze website te vertrouwen. Dat is het punt
              van dit systeem: je hoeft niemand op zijn woord te geloven.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 600 }}>Waarop je bood</Typography>
            <Typography variant="body2" color="text.secondary">
              Deze code hoort bij de woninggegevens zoals ze op dit moment zijn: de kenmerken, de omschrijving, de
              lijst roerende zaken en de spelregels. Wordt daar later iets aan veranderd, dan verandert de code mee, en
              is dat dus aantoonbaar.
            </Typography>
            <Typography variant="body2">
              <code>{listing.dossierHash}</code>
            </Typography>
          </Stack>

          {myBid && (
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 600 }}>Je ontvangstbewijs</Typography>
              <Typography variant="body2" color="text.secondary">
                Hiermee toon je later aan dat precies jouw bod is meegeteld, op dit moment, en dat er niets tussen is
                geschoven. Het bedrag staat er bewust niet bij: deze server kan dat zelf nog niet lezen.
              </Typography>
              <Table size="small">
                <TableBody>
                  <Rij kop="Ingediend">{new Date(myBid.createdAt).toLocaleString("nl-NL")}</Rij>
                  <Rij kop="Laatst gewijzigd">
                    {new Date(myBid.updatedAt).toLocaleString("nl-NL")} (versie {myBid.version})
                  </Rij>
                  <Rij kop="Kenmerk van je bod">
                    <code>{myBid.bidId}</code>
                  </Rij>
                  <Rij kop="Regel in het logboek">#{myBid.logIndex}</Rij>
                  <Rij kop="Vingerafdruk">
                    <code>{myBid.entryHash}</code>
                  </Rij>
                </TableBody>
              </Table>
            </Stack>
          )}

          {logbook && (
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 600 }}>Het logboek controleren</Typography>
              <Typography variant="body2" color="text.secondary">
                Elke regel in het logboek bevat de vingerafdruk van de regel ervóór. Wie achteraf iets wijzigt,
                invoegt of weghaalt, breekt die ketting op een zichtbare plek. Hieronder rekent <em>jouw browser</em>{" "}
                de hele ketting opnieuw uit.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <Button variant="outlined" onClick={controleer}>
                  Controleer of er niets gewijzigd is
                </Button>
                <Button variant="text" startIcon={<DownloadIcon />} onClick={download}>
                  Download het logboek
                </Button>
              </Stack>
              {chainCheck && (
                <Alert severity={chainCheck.valid ? "success" : "error"}>
                  {chainCheck.valid
                    ? "De ketting klopt: geen enkele regel is gewijzigd, ingevoegd of verwijderd."
                    : `De ketting breekt bij regel ${chainCheck.firstBrokenIndex}.`}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                Wat deze controle <strong>niet</strong> zegt: of dit logboek echt van deze instantie komt. Daarvoor is
                de handtekening onderaan het logboek nodig, en die kun je alleen buiten de browser natrekken. Download
                het logboek en draai <code>openbod-verify logbook logboek.json</code>; dat controleert de ketting, de
                eindhash én de handtekening.
              </Typography>
            </Stack>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
