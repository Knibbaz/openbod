import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import MuiLink from "@mui/material/Link";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import {
  coreApi,
  getToken,
  type Listing,
  type Logbook,
  type MyBid,
} from "../lib/api";
import { Aftelklok } from "../components/Aftelklok";
import { Bewijspaneel } from "../components/Bewijspaneel";
import { Fotogalerij } from "../components/Fotogalerij";
import { Kenmerkenblok } from "../components/Kenmerkenblok";
import { Sectie } from "../components/Sectie";
import { Biedmodule } from "../components/Biedmodule";
import { CHOICE_LABELS, STATUS_LABELS, VOORBEHOUD_LABELS, euro, isoToDate } from "../lib/biedlabels";
import { StatusChip } from "../components/StatusChip";

const PRIJSVORM_LABELS: Record<Listing["prijsVorm"], string> = {
  vraagprijs: "Vraagprijs",
  richtprijs: "Richtprijs",
  bieden_vanaf: "Bieden vanaf",
};

export function Woning() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myBid, setMyBid] = useState<MyBid | null>(null);
  const [zojuistGeboden, setZojuistGeboden] = useState(false);
  const [formulierOpen, setFormulierOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function poll() {
      try {
        const l = await coreApi.getListing(id!);
        if (cancelled) return;
        setListing(l);
        if (getToken() && l.status === "biedfase") {
          const mine = await coreApi.getMyBid(id!);
          if (!cancelled) setMyBid(mine);
        }
        if (l.status === "onthuld" || l.status === "onherroepelijk" || l.status === "buiten_procedure") {
          const lb = await coreApi.getLogbook(id!);
          if (!cancelled) setLogbook(lb);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  async function onWithdraw() {
    if (!id || !myBid) return;
    if (!confirm("Je bod intrekken? Je kunt daarna een nieuw bod uitbrengen zolang de inschrijving open is.")) return;
    setError(null);
    try {
      await coreApi.withdrawBid(id, myBid.bidId);
      setMyBid(null);
      setZojuistGeboden(false);
    } catch (err) {
      setError(String(err));
    }
  }

  function labelForItem(itemId: string): string {
    return listing?.takeoverItems.find((i) => i.itemId === itemId)?.label ?? itemId;
  }

  if (error && !listing) return <Alert severity="error">{error}</Alert>;
  if (!listing) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary">Laden…</Typography>
      </Stack>
    );
  }

  const magBieden = listing.status === "biedfase";
  const toonFormulier = magBieden && (formulierOpen || !myBid);

  return (
    <Stack spacing={4}>
      <Fotogalerij fotos={listing.fotos} alt={listing.address} />

      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "flex-end" } }}>
          <Stack spacing={0.5} sx={{ mr: "auto" }}>
            <Typography variant="h1">{listing.address}</Typography>
            {listing.askingPrice !== undefined && (
              <Typography variant="h2" color="primary.main">
                {euro(listing.askingPrice)}{" "}
                <Typography component="span" variant="body2" color="text.secondary">
                  {PRIJSVORM_LABELS[listing.prijsVorm].toLowerCase()}
                </Typography>
              </Typography>
            )}
          </Stack>
          <StatusChip status={listing.status} />
        </Stack>
        <Kenmerkenblok kenmerken={listing.kenmerken} />
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {magBieden && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: "primary.main" }}>
          <Stack spacing={2}>
            <Aftelklok deadline={listing.deadline} />
            <Divider />
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <LockIcon fontSize="small" color="primary" />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 240 }}>
                Alle biedingen zijn versleuteld tot de sluitingstijd. Niemand kan ze eerder inzien, ook de makelaar
                niet en deze website niet. Op de sluitingstijd gaan ze allemaal tegelijk open.
              </Typography>
            </Stack>
            {listing.bidCount !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Er {listing.bidCount === 1 ? "is" : "zijn"} nu <strong>{listing.bidCount}</strong>{" "}
                {listing.bidCount === 1 ? "bod" : "biedingen"} uitgebracht. De bedragen zijn voor niemand zichtbaar.
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {zojuistGeboden && myBid && (
        <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
          <AlertTitle>Je bod staat genoteerd</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Je bod is versleuteld verstuurd en opgenomen in het logboek. Vanaf nu kan niemand het nog inzien of
            wijzigen, jijzelf ook niet, behalve door het aan te passen of in te trekken.
          </Typography>
          <Typography variant="body2">
            Op de sluitingstijd gaan alle biedingen vanzelf open. Je hoeft daar niets voor te doen en niet online te
            zijn. Als de verkoper heeft gekozen, krijg je automatisch het volledige logboek toegestuurd.
          </Typography>
        </Alert>
      )}

      {listing.status === "buiten_procedure" && (
        <Alert severity="warning">
          <AlertTitle>Deze verkoop is buiten de inschrijving om afgehandeld</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Opgegeven reden: <strong>{listing.buitenProcedureReden}</strong>
            {listing.buitenProcedureAt && ` (${new Date(listing.buitenProcedureAt).toLocaleString("nl-NL")})`}
          </Typography>
          <Typography variant="body2">
            Biedingen die op dat moment nog verzegeld waren, zijn niet alsnog geopend. Je houdt wel het bewijs dat je
            bod er stond en dat niemand het ooit heeft ingezien.
          </Typography>
        </Alert>
      )}

      {listing.status === "gesloten" && (
        <Alert severity="info" icon={false}>
          <AlertTitle>De inschrijving is gesloten</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Alle biedingen gaan nu vanzelf open. Dat duurt een paar seconden, want er wordt gewacht op de openbare
            sleutel die op de sluitingstijd beschikbaar komt.
          </Typography>
          <LinearProgress />
        </Alert>
      )}

      {(listing.omschrijving || listing.externeLink) && (
        <Sectie titel="Over deze woning">
          {listing.omschrijving && (
            <Typography sx={{ whiteSpace: "pre-line", maxWidth: "70ch" }}>{listing.omschrijving}</Typography>
          )}
          {listing.externeLink && (
            <Typography variant="body2">
              Deze woning staat ook op{" "}
              <MuiLink href={listing.externeLink} target="_blank" rel="noopener noreferrer">
                de pagina van de verkopende partij
              </MuiLink>
              , met de brochure en meer foto's. Die pagina hoort bij het dossier waarop je biedt.
            </Typography>
          )}
        </Sectie>
      )}

      {listing.takeoverItems.length > 0 && (
        <Sectie
          titel="Wat blijft en wat kun je overnemen"
          toelichting="De verkoper heeft dit vooraf vastgelegd. Wat jij hiervan wilt overnemen, geef je op bij je bod, dus het telt mee in de afweging in plaats van dat het er los achteraan komt."
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listing.takeoverItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>
                      {STATUS_LABELS[item.status]}
                      {item.amount !== undefined && ` (${euro(item.amount)})`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Sectie>
      )}

      {magBieden && myBid && !toonFormulier && (
        <Sectie
          titel="Je hebt een bod uitgebracht"
          toelichting="Zolang de inschrijving open is, kun je het vervangen of intrekken. Dát je iets wijzigt komt in het logboek te staan; wát je wijzigt blijft tot de sluitingstijd voor iedereen onleesbaar."
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
            {listing.rules.aanpassenToegestaan ? (
              <Button variant="contained" onClick={() => setFormulierOpen(true)}>
                Mijn bod aanpassen
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aanpassen is bij deze woning niet toegestaan. Dat stond vooraf vast, voor iedereen gelijk.
              </Typography>
            )}
            {listing.rules.intrekkenToegestaan && (
              <Button color="error" variant="outlined" onClick={onWithdraw}>
                Bod intrekken
              </Button>
            )}
          </Stack>
        </Sectie>
      )}

      <Biedmodule
        listing={listing}
        myBid={myBid}
        open={toonFormulier}
        onOpenen={() => setFormulierOpen(true)}
        onSluiten={() => setFormulierOpen(false)}
        onGeplaatst={(bod) => {
          setMyBid(bod);
          setZojuistGeboden(true);
          setFormulierOpen(false);
          setError(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onFout={setError}
      />

      {logbook && (
        <Sectie
          titel="De uitslag"
          toelichting="Alle biedingen, zoals ze op de sluitingstijd tevoorschijn kwamen. Namen staan er niet in en motivaties ook niet: die gaan alleen naar de verkoper."
        >
          {logbook.entries.length === 0 ? (
            <Typography color="text.secondary">
              Er zijn geen biedingen geopend. Wat er wel is, staat in het bewijspaneel hieronder.
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bieder</TableCell>
                    <TableCell align="right">Bedrag</TableCell>
                    <TableCell>Oplevering</TableCell>
                    <TableCell>Voorbehouden</TableCell>
                    <TableCell>Roerende zaken</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...logbook.entries]
                    .sort((a, b) => b.amount - a.amount)
                    .map((e, i) => (
                      <TableRow key={i} selected={listing.awardedBidId === e.bidId}>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <span>{e.bidderRef}</span>
                            {listing.awardedBidId === e.bidId && (
                              <Chip size="small" color="primary" label="gegund" />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {e.valid ? euro(e.amount) : "ongeldig"}
                        </TableCell>
                        <TableCell>{e.valid ? isoToDate(e.handoverDate) : "-"}</TableCell>
                        <TableCell>
                          {!e.valid
                            ? "-"
                            : e.conditions.length === 0
                              ? "geen"
                              : e.conditions
                                  .map((c) => VOORBEHOUD_LABELS.find((v) => v.type === c.type)?.label ?? c.type)
                                  .join(", ")}
                        </TableCell>
                        <TableCell>
                          {!e.valid
                            ? "-"
                            : e.takeover.length === 0
                              ? "geen"
                              : e.takeover
                                  .map(
                                    (t) =>
                                      `${labelForItem(t.itemId)}: ${CHOICE_LABELS[t.choice]}` +
                                      (t.amount !== undefined ? ` (${euro(t.amount)})` : ""),
                                  )
                                  .join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Sectie>
      )}

      <Bewijspaneel listing={listing} myBid={myBid} logbook={logbook} />
    </Stack>
  );
}
