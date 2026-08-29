import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PersonIcon from "@mui/icons-material/PersonOutlineOutlined";
import SendIcon from "@mui/icons-material/MarkEmailReadOutlined";
import { coreApi, type Delivery, type Listing, type Logbook } from "../lib/api";
import type { OvernameChoice } from "../lib/seal";
import { loadSellerKey, openIdentity, type BidderIdentity } from "../lib/identity-envelope";
import { Aftelklok } from "../components/Aftelklok";
import { Bewijspaneel } from "../components/Bewijspaneel";
import { Sectie } from "../components/Sectie";
import { StatusChip } from "../components/StatusChip";

const VOORBEHOUD_LABELS: Record<string, string> = {
  financieel: "Financiering",
  bouwdepot: "Bouwdepot",
  bouwkundige_keuring: "Bouwkundige keuring",
  verkoop_eigen_woning: "Verkoop eigen woning",
  nhg: "NHG",
  anders: "Anders",
};

const CHOICE_LABELS: Record<OvernameChoice["choice"], string> = {
  geen: "Geen interesse",
  gevraagd_bedrag: "Voor het gevraagde bedrag",
  eigen_bod: "Eigen bod",
  in_overleg: "In overleg",
};

function euro(bedrag: number): string {
  return `€ ${bedrag.toLocaleString("nl-NL")}`;
}

function isoToDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString("nl-NL") : "-";
}

export function BeheerWoning() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [awardedIdentity, setAwardedIdentity] = useState<BidderIdentity | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [abortReason, setAbortReason] = useState("");
  const [aborting, setAborting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function poll() {
      try {
        const l = await coreApi.getListing(id!);
        if (cancelled) return;
        setListing(l);
        if (l.status === "onthuld" || l.status === "onherroepelijk" || l.status === "buiten_procedure") {
          const lb = await coreApi.getLogbook(id!);
          if (!cancelled) setLogbook(lb);
        }
        if (l.status === "onherroepelijk" || l.status === "buiten_procedure") {
          const d = await coreApi.getDelivery(id!);
          if (!cancelled) setDelivery(d);
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

  /** Gunnen aan één bod, en pas dán de identiteit van die bieder openen. */
  async function onPublish() {
    if (!id) return;
    setError(null);
    try {
      setListing(await coreApi.publishListing(id));
    } catch (err) {
      setError(String(err));
    }
  }

  async function onAward(bidId: string) {
    if (!id || !listing) return;
    const entry = logbook?.entries.find((e) => e.bidId === bidId);
    if (!confirm(`Gunnen aan ${entry?.bidderRef} voor ${entry ? euro(entry.amount) : "dit bod"}? Dit is definitief.`)) {
      return;
    }
    const sellerKey = loadSellerKey(listing.id);
    setAwarding(true);
    setError(null);
    try {
      const result = await coreApi.award(id, bidId);
      setLogbook(result.logbook);
      if (result.identityEnvelope && sellerKey) {
        setAwardedIdentity(await openIdentity(sellerKey, result.identityEnvelope));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setAwarding(false);
    }
  }

  /**
   * De verkoop is buiten deze inschrijving om afgehandeld. Dit verhindert zo'n
   * verkoop niet, dat kan geen enkel systeem, maar het dwingt af dat er een
   * vastgelegde afloop met reden overblijft en dat alle bieders automatisch het
   * logboek krijgen.
   */
  async function onAbort() {
    if (!id) return;
    if (abortReason.trim().length < 3) {
      setError("Geef een reden op. Die komt onverkort in het openbare logboek.");
      return;
    }
    if (!confirm("Deze inschrijving definitief afsluiten buiten het biedproces om? Dit is onomkeerbaar.")) return;
    setAborting(true);
    setError(null);
    try {
      setLogbook(await coreApi.abort(id, abortReason.trim()));
      setAbortReason("");
    } catch (err) {
      setError(String(err));
    } finally {
      setAborting(false);
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

  const heeftSleutel = loadSellerKey(listing.id) !== null;
  const afgerond = listing.status === "onherroepelijk" || listing.status === "buiten_procedure";
  const geldigeBiedingen = [...(logbook?.entries ?? [])].filter((e) => e.valid).sort((a, b) => b.amount - a.amount);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Link component={RouterLink} to="/beheer" variant="body2">
          Terug naar het overzicht
        </Link>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <Typography variant="h1" sx={{ mr: "auto" }}>
            {listing.address}
          </Typography>
          <StatusChip status={listing.status} />
        </Stack>
        <Link component={RouterLink} to={`/woningen/${listing.id}`} variant="body2">
          Bekijk de pagina zoals een koper hem ziet
        </Link>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!heeftSleutel && (
        <Alert severity="warning">
          <AlertTitle>Dit apparaat heeft de sleutel van deze woning niet</AlertTitle>
          Je kunt de biedingen wel zien, maar niet gunnen: daarvoor is de sleutel nodig die bij het klaarzetten in de
          browser van de verkoper is achtergebleven. Dat is precies wat voorkomt dat deze website zelf bij de
          identiteit van bieders kan.
        </Alert>
      )}

      {listing.status === "aangemaakt" && (
        <Sectie
          titel="Nog een concept"
          toelichting="Deze woning staat niet in de publieke lijst en er kan niet op geboden worden. Zolang je hem niet openstelt, ligt er ook nog niets vast: het logboek begint op het moment van openstellen, met de woninggegevens en de spelregels zoals ze dan zijn."
        >
          <Typography variant="body2" color="text.secondary">
            Sluitingstijd zoals hij nu staat: {new Date(listing.deadline).toLocaleString("nl-NL")}. Controleer die
            voordat je openstelt, want daarna staat hij vast.
          </Typography>
          <Button variant="contained" onClick={onPublish} sx={{ alignSelf: "flex-start" }}>
            Openstellen voor biedingen
          </Button>
        </Sectie>
      )}

      {listing.status === "biedfase" && (
        <Sectie
          titel="De inschrijving loopt"
          toelichting="Je ziet tot de sluitingstijd geen enkel bedrag, en dat is geen instelling die iemand kan omzetten: de biedingen zijn versleuteld en de sleutel bestaat nog niet. Dat is precies de reden dat een koper erop kan vertrouwen dat er niet gestuurd wordt."
        >
          <Aftelklok deadline={listing.deadline} />
          {listing.bidCount !== undefined && (
            <Typography>
              <strong>{listing.bidCount}</strong> {listing.bidCount === 1 ? "bod" : "biedingen"} uitgebracht.
            </Typography>
          )}
        </Sectie>
      )}

      {listing.status === "gesloten" && (
        <Sectie titel="Gesloten, de biedingen gaan nu open">
          <Typography variant="body2" color="text.secondary">
            Er wordt gewacht op de openbare sleutel die bij de sluitingstijd hoort. Dit duurt normaal enkele seconden.
          </Typography>
          <LinearProgress />
        </Sectie>
      )}

      {listing.status === "buiten_procedure" && (
        <Alert severity="warning">
          <AlertTitle>Buiten de inschrijving om afgehandeld</AlertTitle>
          Opgegeven reden: <strong>{listing.buitenProcedureReden}</strong>
          {listing.buitenProcedureAt && ` (${new Date(listing.buitenProcedureAt).toLocaleString("nl-NL")})`}
        </Alert>
      )}

      {logbook && geldigeBiedingen.length > 0 && (
        <Sectie
          titel="De biedingen"
          toelichting="Hoog naar laag, met het hele pakket erbij. Kijk niet alleen naar het bedrag: een lager bod zonder voorbehouden kan meer zekerheid geven dan een hoger bod met financieringsvoorbehoud. Namen zie je pas als je gunt."
        >
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Bieder</TableCell>
                  <TableCell align="right">Bedrag</TableCell>
                  <TableCell>Oplevering</TableCell>
                  <TableCell>Geldig tot</TableCell>
                  <TableCell>Voorbehouden</TableCell>
                  <TableCell>Roerende zaken</TableCell>
                  {heeftSleutel && !listing.awardedBidId && !afgerond && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {geldigeBiedingen.map((e) => (
                  <TableRow key={e.bidId} selected={listing.awardedBidId === e.bidId}>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <span>{e.bidderRef}</span>
                        {listing.awardedBidId === e.bidId && <Chip size="small" color="primary" label="gegund" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {euro(e.amount)}
                    </TableCell>
                    <TableCell>{isoToDate(e.handoverDate)}</TableCell>
                    <TableCell>{isoToDate(e.validUntil)}</TableCell>
                    <TableCell>
                      {e.conditions.length === 0 ? (
                        <Chip size="small" variant="outlined" label="geen" />
                      ) : (
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                          {e.conditions.map((c, i) => (
                            <Chip
                              key={i}
                              size="small"
                              variant="outlined"
                              label={VOORBEHOUD_LABELS[c.type] ?? c.type}
                            />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.takeover.length === 0
                        ? "geen"
                        : e.takeover
                            .map(
                              (t) =>
                                `${labelForItem(t.itemId)}: ${CHOICE_LABELS[t.choice]}` +
                                (t.amount !== undefined ? ` (${euro(t.amount)})` : ""),
                            )
                            .join("; ")}
                    </TableCell>
                    {heeftSleutel && !listing.awardedBidId && !afgerond && (
                      <TableCell>
                        <Button size="small" variant="contained" onClick={() => onAward(e.bidId)} disabled={awarding}>
                          Gun
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="info">
            Motivaties zijn hier nog niet zichtbaar. Bieders kunnen er wel een meesturen en die is uitsluitend voor
            jou bedoeld, maar deze instantie kan nog niet vaststellen dát jij de verkoper bent, en dan zou zo'n
            endpoint de motivatie aan iedereen tonen. Zie de bekende beperkingen in DEVELOPMENT.md.
          </Alert>

          {logbook.entries.some((e) => !e.valid) && (
            <Alert severity="warning">
              Er {logbook.entries.filter((e) => !e.valid).length === 1 ? "is een bod" : "zijn biedingen"} als ongeldig
              gemarkeerd: de inhoud kwam niet overeen met wat er bij het indienen was vastgelegd. Dat staat in het
              logboek en is dus achteraf te controleren.
            </Alert>
          )}
        </Sectie>
      )}

      {awardedIdentity && (
        <Alert severity="success" icon={<PersonIcon fontSize="inherit" />}>
          <AlertTitle>Je hebt gegund, en hier is de koper</AlertTitle>
          <strong>{awardedIdentity.name}</strong>
          {awardedIdentity.contact && ` (${awardedIdentity.contact})`}. Tot dit moment was deze naam voor niemand
          leesbaar, ook niet voor deze website. Dat de naam nu is vrijgegeven, staat als aparte regel in het logboek.
        </Alert>
      )}

      {listing.awardedBidId && !awardedIdentity && heeftSleutel && (
        <Alert severity="warning">
          Er is gegund, maar de naam kon niet geopend worden. Dat gebeurt als deze browser de sleutel niet meer heeft,
          of als de bieder geen naam meestuurde.
        </Alert>
      )}

      {delivery && (
        <Alert severity="success" icon={<SendIcon fontSize="inherit" />}>
          <AlertTitle>Het logboek is verstuurd</AlertTitle>
          Op {new Date(delivery.deliveredAt).toLocaleString("nl-NL")} naar {delivery.recipientRefs.length}{" "}
          {delivery.recipientRefs.length === 1 ? "betrokkene" : "betrokkenen"}. Je hoefde daar niets voor te doen en
          niemand hoefde erom te vragen. Dat de verzending heeft plaatsgevonden, staat zelf ook in het logboek.
        </Alert>
      )}

      {heeftSleutel && !afgerond && (
        <Sectie
          titel="Buiten deze inschrijving afhandelen"
          toelichting="Wordt de woning onderhands verkocht, van de markt gehaald of anderszins buiten dit proces afgehandeld? Sluit de inschrijving dan hier af met een reden. Zonder dat blijft hij openstaan zonder uitleg, en dat is precies waarover kopers klagen. Alle bieders krijgen daarna automatisch het logboek."
        >
          <TextField
            label="Reden"
            value={abortReason}
            onChange={(e) => setAbortReason(e.target.value)}
            placeholder="Bijvoorbeeld: woning onderhands verkocht buiten de inschrijving om"
            helperText="Komt onverkort in het openbare logboek, dus geen persoonsgegevens van bieders."
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Button
            color="warning"
            variant="outlined"
            onClick={onAbort}
            disabled={aborting}
            sx={{ alignSelf: "flex-start" }}
          >
            {aborting ? "Vastleggen…" : "Inschrijving afsluiten en logboek versturen"}
          </Button>
        </Sectie>
      )}

      <Bewijspaneel listing={listing} logbook={logbook} />
    </Stack>
  );
}
