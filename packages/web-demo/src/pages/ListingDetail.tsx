import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import VerifiedIcon from "@mui/icons-material/VerifiedOutlined";
import {
  coreApi,
  getToken,
  type Delivery,
  type Listing,
  type Logbook,
  type MyBid,
  type OvernameStatus,
  type TakeoverItem,
} from "../lib/api";
import { sealBid, type OvernameChoice, type Voorbehoud } from "../lib/seal";
import { loadSellerKey, openIdentity, sealIdentity, type BidderIdentity } from "../lib/identity-envelope";
import { verifyHashChainInBrowser } from "../lib/verify";
import { Sectie } from "../components/Sectie";
import { StatusChip } from "../components/StatusChip";

const VOORBEHOUD_LABELS: { type: Voorbehoud["type"]; label: string }[] = [
  { type: "financieel", label: "Financieel voorbehoud" },
  { type: "bouwdepot", label: "Bouwdepot" },
  { type: "bouwkundige_keuring", label: "Bouwkundige keuring" },
  { type: "verkoop_eigen_woning", label: "Verkoop eigen woning" },
  { type: "nhg", label: "NHG" },
  { type: "anders", label: "Anders" },
];

const STATUS_LABELS: Record<OvernameStatus, string> = {
  blijft_achter: "Blijft achter",
  gevraagd_bedrag: "Ter overname",
  in_overleg: "Ter overname, in overleg",
  niet_beschikbaar: "Niet beschikbaar",
};

const CHOICE_LABELS: Record<OvernameChoice["choice"], string> = {
  geen: "Geen interesse",
  gevraagd_bedrag: "Overnemen voor het gevraagde bedrag",
  eigen_bod: "Eigen bod",
  in_overleg: "In overleg",
};

/** Welke keuzes de bieder heeft, gegeven wat de verkoper over het item zei. */
function choicesFor(status: OvernameStatus): OvernameChoice["choice"][] {
  if (status === "gevraagd_bedrag") return ["geen", "gevraagd_bedrag", "eigen_bod", "in_overleg"];
  if (status === "in_overleg") return ["geen", "eigen_bod", "in_overleg"];
  return [];
}

/** Een `<input type="date">` levert YYYY-MM-DD; het biedschema wil RFC3339. */
function dateToIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function isoToDate(value?: string): string {
  return value ? value.slice(0, 10) : "-";
}

function euro(bedrag: number): string {
  return `€ ${bedrag.toLocaleString("nl-NL")}`;
}

interface VoorbehoudState {
  selected: boolean;
  deadline: string;
  note: string;
}

interface TakeoverState {
  choice: OvernameChoice["choice"];
  amount: string;
}

/** Een regel in een sleutel-waardetabel, zoals het ontvangstbewijs. */
function Rij({ kop, children }: { kop: string; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={{ width: "35%", verticalAlign: "top" }}>
        {kop}
      </TableCell>
      <TableCell>{children}</TableCell>
    </TableRow>
  );
}

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(510000);
  const [motivation, setMotivation] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [conditions, setConditions] = useState<Record<string, VoorbehoudState>>({});
  const [takeover, setTakeover] = useState<Record<string, TakeoverState>>({});
  const [sealing, setSealing] = useState(false);
  const [myBid, setMyBid] = useState<MyBid | null>(null);
  const [bidderName, setBidderName] = useState("");
  const [bidderContact, setBidderContact] = useState("");
  const [awardedIdentity, setAwardedIdentity] = useState<BidderIdentity | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [abortReason, setAbortReason] = useState("");
  const [aborting, setAborting] = useState(false);

  const [chainCheck, setChainCheck] = useState<{ valid: boolean; firstBrokenIndex?: number } | null>(null);

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
        // E4-S3: het bewijs dát het logboek is verstuurd. Niemand hoeft erom te
        // vragen; deze pagina laat alleen zien wat er al vanzelf gebeurd is.
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

  function conditionState(type: string): VoorbehoudState {
    return conditions[type] ?? { selected: false, deadline: "", note: "" };
  }

  function setCondition(type: string, patch: Partial<VoorbehoudState>) {
    setConditions((prev) => ({ ...prev, [type]: { ...conditionState(type), ...patch } }));
  }

  function takeoverState(item: TakeoverItem): TakeoverState {
    return takeover[item.itemId] ?? { choice: "geen", amount: "" };
  }

  function setTakeoverChoice(itemId: string, patch: Partial<TakeoverState>) {
    setTakeover((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { choice: "geen", amount: "" }), ...patch },
    }));
  }

  /** Bouwt het pakket dat straks verzegeld wordt: alleen wat de bieder echt koos. */
  function buildBidPayload() {
    const chosenConditions: Voorbehoud[] = VOORBEHOUD_LABELS.filter((v) => conditionState(v.type).selected).map((v) => {
      const state = conditionState(v.type);
      return {
        type: v.type,
        deadline: dateToIso(state.deadline),
        note: state.note.trim() || undefined,
      };
    });

    const chosenTakeover: OvernameChoice[] = (listing?.takeoverItems ?? [])
      .filter((item) => choicesFor(item.status).length > 0)
      .map((item) => ({ item, state: takeoverState(item) }))
      .filter(({ state }) => state.choice !== "geen")
      .map(({ item, state }) => ({
        itemId: item.itemId,
        choice: state.choice,
        amount: state.choice === "eigen_bod" ? Number(state.amount) : undefined,
      }));

    return {
      amount,
      handoverDate: dateToIso(handoverDate),
      validUntil: dateToIso(validUntil),
      conditions: chosenConditions,
      motivation: motivation || undefined,
      takeover: chosenTakeover,
    };
  }

  /**
   * E7-S2: de verkoop is buiten deze procedure om afgehandeld. Dit verhindert
   * zo'n verkoop niet, dat kan geen enkel systeem, maar het dwingt af dat de
   * procedure een eindstatus met opgegeven reden krijgt en dat alle bieders
   * daarover automatisch het logboek ontvangen.
   */
  async function onAbort() {
    if (!id) return;
    if (abortReason.trim().length < 3) {
      setError("Geef een reden op. Die komt onverkort in het openbare logboek.");
      return;
    }
    if (!confirm("Deze procedure definitief afsluiten buiten het biedproces om? Dit is onomkeerbaar.")) return;
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

  async function onBid() {
    if (!id || !listing) return;
    if (!getToken()) {
      setError("Log eerst in via de magic link.");
      return;
    }
    const payload = buildBidPayload();
    const eigenBodZonderBedrag = payload.takeover.some(
      (t) => t.choice === "eigen_bod" && !(typeof t.amount === "number" && t.amount > 0),
    );
    if (eigenBodZonderBedrag) {
      setError("Vul een bedrag in bij elk item waarvoor je een eigen bod doet.");
      return;
    }
    if (listing.sellerPublicKey && !bidderName.trim()) {
      setError("Vul je naam in. Die gaat versleuteld mee en is alleen leesbaar voor de verkoper, ná gunning.");
      return;
    }
    setSealing(true);
    setError(null);
    try {
      // Twee gescheiden versleutelingen: het bod naar de deadline (iedereen mag het
      // dan lezen), de identiteit naar de verkoper (alleen hij mag het ooit lezen).
      const identityEnvelope = listing.sellerPublicKey
        ? await sealIdentity(listing.sellerPublicKey, { name: bidderName.trim(), contact: bidderContact.trim() })
        : undefined;
      const { commitment, ciphertext } = await sealBid(payload, listing.deadline);
      // Aanpassen is een nieuwe verzegeling van het hele pakket, geen patch op de
      // inhoud: de core kan het oude bod niet lezen, dus er valt niets te wijzigen
      // behalve het geheel. Het logboek houdt beide versies vast.
      const res = myBid
        ? await coreApi.adjustBid(id, myBid.bidId, commitment, ciphertext, identityEnvelope)
        : await coreApi.placeBid(id, commitment, ciphertext, identityEnvelope);
      setMyBid({
        ...res,
        version: (myBid?.version ?? 0) + 1,
        createdAt: myBid?.createdAt ?? res.timestamp,
        updatedAt: res.timestamp,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSealing(false);
    }
  }

  async function onWithdraw() {
    if (!id || !myBid) return;
    setError(null);
    try {
      await coreApi.withdrawBid(id, myBid.bidId);
      setMyBid(null);
    } catch (err) {
      setError(String(err));
    }
  }

  /** Gunnen aan één bod, en pas dán de identiteit van die bieder openen. */
  async function onAward(bidId: string) {
    if (!id || !listing) return;
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

  async function onVerify() {
    if (!logbook) return;
    const result = await verifyHashChainInBrowser(logbook.log);
    setChainCheck(result);
  }

  function labelForItem(itemId: string): string {
    return listing?.takeoverItems.find((i) => i.itemId === itemId)?.label ?? itemId;
  }

  function downloadLogbook() {
    if (!logbook || !listing) return;
    const blob = new Blob([JSON.stringify(logbook, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logboek-${listing.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error && !listing) return <Alert severity="error">{error}</Alert>;
  if (!listing) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
        <Typography color="text.secondary">Laden…</Typography>
      </Stack>
    );
  }

  const biedbareItems = listing.takeoverItems.filter((item) => choicesFor(item.status).length > 0);
  // Je bent hier de verkoper als je de private sleutel van deze woning hebt.
  const isSeller = loadSellerKey(listing.id) !== null;
  const afgerond = listing.status === "onherroepelijk" || listing.status === "buiten_procedure";

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="h1">{listing.address}</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <StatusChip status={listing.status} />
          <Chip
            size="small"
            variant="outlined"
            label={`Deadline ${new Date(listing.deadline).toLocaleString("nl-NL")}`}
          />
          {listing.bidCount !== undefined && (
            <Chip
              size="small"
              variant="outlined"
              label={`${listing.bidCount} bieding${listing.bidCount === 1 ? "" : "en"}, bedragen pas na onthulling`}
            />
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {listing.status === "buiten_procedure" && (
        <Alert severity="warning">
          <AlertTitle>Buiten deze procedure afgehandeld</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Deze verkoop is niet via de deadline en de gunning afgerond. Opgegeven reden:{" "}
            <strong>{listing.buitenProcedureReden}</strong>
            {listing.buitenProcedureAt && ` (${new Date(listing.buitenProcedureAt).toLocaleString("nl-NL")})`}
          </Typography>
          <Typography variant="body2">
            Verzegelde biedingen die op dat moment nog niet geopend waren, blijven verzegeld: ze worden niet alsnog
            opengemaakt voor een procedure die niet doorgaat. Wat je wél houdt, is het bewijs dát je bod er stond en
            dat het nooit geopend is, zichtbaar in de keten hieronder.
          </Typography>
        </Alert>
      )}

      {listing.takeoverItems.length > 0 && (
        <Sectie titel="Roerende zaken">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Status volgens verkoper</TableCell>
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

      {listing.status === "biedfase" && myBid && (
        <Sectie
          titel="Jouw lopende bod"
          toelichting="Dit is je bewijs dat je bod in het logboek staat. Bewaar het: na de onthulling kun je hiermee narekenen dat precies dit bod is meegeteld. Het bedrag staat er bewust niet bij, want de server kan dat zelf nog niet lezen."
        >
          <TableContainer>
            <Table size="small">
              <TableBody>
                <Rij kop="Ingediend op">{new Date(myBid.createdAt).toLocaleString("nl-NL")}</Rij>
                <Rij kop="Laatst gewijzigd">
                  {new Date(myBid.updatedAt).toLocaleString("nl-NL")} (versie {myBid.version})
                </Rij>
                <Rij kop="bidId">
                  <code>{myBid.bidId}</code>
                </Rij>
                <Rij kop="Logregel">#{myBid.logIndex}</Rij>
                <Rij kop="entryHash">
                  <code>{myBid.entryHash}</code>
                </Rij>
              </TableBody>
            </Table>
          </TableContainer>
          {listing.rules.intrekkenToegestaan ? (
            <Button color="error" variant="outlined" onClick={onWithdraw} sx={{ alignSelf: "flex-start" }}>
              Bod intrekken
            </Button>
          ) : (
            <Alert severity="info">
              Intrekken is voor deze woning niet toegestaan. Dat stond vooraf vast, voor iedereen gelijk.
            </Alert>
          )}
        </Sectie>
      )}

      {listing.status === "biedfase" && (
        <Sectie
          titel={myBid ? "Je bod aanpassen" : "Verzegeld bod plaatsen"}
          toelichting="Je hele bod (bedrag, datums, voorbehouden, overname en motivatie) wordt in deze browser versleuteld naar de deadline. Deze server kan het pas erna lezen."
        >
          {myBid && !listing.rules.aanpassenToegestaan && (
            <Alert severity="info">
              Aanpassen is voor deze woning niet toegestaan. Dat stond vooraf vast, voor iedereen gelijk.
            </Alert>
          )}
          {myBid && listing.rules.aanpassenToegestaan && (
            <Alert severity="info">
              Je vervangt hiermee je hele bod door een nieuwe verzegeling. Dat je hebt aangepast blijft in het logboek
              staan, wat je aanpaste niet. Dat is tot de deadline voor niemand leesbaar.
            </Alert>
          )}

          {listing.sellerPublicKey && (
            <>
              <Divider textAlign="left">
                <Typography variant="overline">Wie je bent</Typography>
              </Divider>
              <Typography variant="body2" color="text.secondary">
                Je naam wordt apart versleuteld naar de verkoper. Deze server kan hem niet lezen, de makelaar ook niet,
                en de verkoper pas op het moment dat hij aan jou gunt. In het openbare logboek verschijnt hij nooit.
              </Typography>
              <Stack spacing={2}>
                <TextField label="Naam" value={bidderName} onChange={(e) => setBidderName(e.target.value)} />
                <TextField
                  label="Contact (optioneel)"
                  placeholder="e-mail of telefoon"
                  value={bidderContact}
                  onChange={(e) => setBidderContact(e.target.value)}
                />
              </Stack>
            </>
          )}

          <Divider textAlign="left">
            <Typography variant="overline">Je bod</Typography>
          </Divider>
          <Stack spacing={2}>
            <TextField
              label="Bedrag"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Gewenste opleverdatum"
                type="date"
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Bod geldig tot"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <TextField
              label="Motivatie (optioneel)"
              multiline
              minRows={2}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              helperText="Gaat alleen naar de verkoper, niet naar de andere bieders, en komt niet in het openbare logboek."
            />
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline">Voorbehouden</Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            Dat je een voorbehoud maakt is straks zichtbaar zonder waardeoordeel. De verkoper weegt zelf zekerheid
            tegen hoogte.
          </Typography>
          <Stack spacing={1}>
            {VOORBEHOUD_LABELS.map((v) => {
              const state = conditionState(v.type);
              return (
                <Box key={v.type}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={state.selected}
                        onChange={(e) => setCondition(v.type, { selected: e.target.checked })}
                      />
                    }
                    label={v.label}
                  />
                  {state.selected && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pl: 4, pb: 1 }}>
                      <TextField
                        label="Geregeld vóór"
                        type="date"
                        value={state.deadline}
                        onChange={(e) => setCondition(v.type, { deadline: e.target.value })}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        label="Toelichting"
                        value={state.note}
                        onChange={(e) => setCondition(v.type, { note: e.target.value })}
                        slotProps={{ htmlInput: { maxLength: 500 } }}
                      />
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Stack>

          {biedbareItems.length > 0 && (
            <>
              <Divider textAlign="left">
                <Typography variant="overline">Roerende zaken ter overname</Typography>
              </Divider>
              <Stack spacing={2}>
                {biedbareItems.map((item) => {
                  const state = takeoverState(item);
                  return (
                    <Stack key={item.itemId} direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        select
                        label={
                          item.amount !== undefined
                            ? `${item.label} (gevraagd ${euro(item.amount)})`
                            : item.label
                        }
                        value={state.choice}
                        onChange={(e) =>
                          setTakeoverChoice(item.itemId, { choice: e.target.value as OvernameChoice["choice"] })
                        }
                      >
                        {choicesFor(item.status).map((c) => (
                          <MenuItem key={c} value={c}>
                            {CHOICE_LABELS[c]}
                          </MenuItem>
                        ))}
                      </TextField>
                      {state.choice === "eigen_bod" && (
                        <TextField
                          label="Jouw bedrag"
                          type="number"
                          value={state.amount}
                          onChange={(e) => setTakeoverChoice(item.itemId, { amount: e.target.value })}
                          slotProps={{
                            htmlInput: { min: 0 },
                            input: { startAdornment: <InputAdornment position="start">€</InputAdornment> },
                          }}
                        />
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            </>
          )}

          <Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<LockIcon />}
              onClick={onBid}
              disabled={sealing || (myBid !== null && !listing.rules.aanpassenToegestaan)}
            >
              {sealing ? "Verzegelen via drand…" : myBid ? "Aangepast bod verzegelen" : "Verzegeld bod indienen"}
            </Button>
          </Box>
        </Sectie>
      )}

      {listing.status === "gesloten" && (
        <Sectie
          titel="Gesloten"
          toelichting="De deadline is verstreken. Zodra drand de rondesleutel publiceert, gaan alle biedingen vanzelf open. Je hoeft hier niets voor te doen en niet online te blijven."
        >
          <LinearProgress />
        </Sectie>
      )}

      {isSeller && !afgerond && (
        <Sectie
          titel="Buiten deze procedure afhandelen"
          toelichting="Wordt de woning onderhands verkocht, van de markt gehaald of anderszins buiten dit biedproces om afgehandeld? Sluit de procedure dan hier af met een reden. Een inschrijving die zonder uitleg stilvalt is precies waarover kopers klagen; dit maakt er een vastgelegde eindstatus van, en alle bieders krijgen automatisch het logboek."
        >
          <TextField
            label="Reden"
            value={abortReason}
            onChange={(e) => setAbortReason(e.target.value)}
            placeholder="Bijvoorbeeld: woning onderhands verkocht buiten de inschrijving om"
            helperText="Komt onverkort in het openbare logboek, dus geen persoonsgegevens van bieders."
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Button color="warning" variant="outlined" onClick={onAbort} disabled={aborting} sx={{ alignSelf: "flex-start" }}>
            {aborting ? "Vastleggen…" : "Procedure afsluiten en logboek versturen"}
          </Button>
        </Sectie>
      )}

      {logbook && (
        <Sectie
          titel="Biedlogboek"
          toelichting="De motivatie staat hier bewust niet in: die gaat alleen naar de verkoper, niet naar de andere bieders. Namen staan er ook niet in, en zijn tot de gunning voor niemand leesbaar."
        >
          {logbook.entries.length === 0 ? (
            <Alert severity="info">
              Er zijn geen onthulde biedingen. Wat er wel is, staat in de keten hieronder: welke verzegelde biedingen er
              stonden, en dat ze nooit geopend zijn.
            </Alert>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bieder</TableCell>
                    <TableCell align="right">Bedrag</TableCell>
                    <TableCell>Oplevering</TableCell>
                    <TableCell>Geldig tot</TableCell>
                    <TableCell>Voorbehouden</TableCell>
                    <TableCell>Overname</TableCell>
                    <TableCell>Geldig</TableCell>
                    {isSeller && <TableCell>Gunning</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logbook.entries.map((e, i) => (
                    <TableRow key={i} selected={listing.awardedBidId === e.bidId}>
                      <TableCell>{e.bidderRef}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {e.valid ? euro(e.amount) : "-"}
                      </TableCell>
                      <TableCell>{e.valid ? isoToDate(e.handoverDate) : "-"}</TableCell>
                      <TableCell>{e.valid ? isoToDate(e.validUntil) : "-"}</TableCell>
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
                      <TableCell>{e.valid ? "ja" : `nee (${e.invalidReason})`}</TableCell>
                      {isSeller && (
                        <TableCell>
                          {listing.awardedBidId === e.bidId ? (
                            <Chip size="small" color="primary" label="gegund" />
                          ) : listing.awardedBidId || !e.valid ? (
                            "-"
                          ) : (
                            <Button size="small" variant="outlined" onClick={() => onAward(e.bidId)} disabled={awarding}>
                              Gun aan deze bieder
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {awardedIdentity && (
            <Alert severity="success">
              <AlertTitle>Identiteit vrijgegeven na gunning</AlertTitle>
              <strong>{awardedIdentity.name}</strong>
              {awardedIdentity.contact && ` (${awardedIdentity.contact})`}. Dat deze vrijgave plaatsvond, staat nu als
              aparte regel in het logboek.
            </Alert>
          )}
          {isSeller && listing.awardedBidId && !awardedIdentity && (
            <Alert severity="warning">
              Er is gegund, maar de identiteit kon niet geopend worden. Dat gebeurt als deze browser de sleutel van
              deze woning niet meer heeft, of als de bieder geen naam meestuurde.
            </Alert>
          )}

          <Divider textAlign="left">
            <Typography variant="overline">Is het logboek verstuurd?</Typography>
          </Divider>
          {delivery ? (
            <Alert severity="success" icon={<VerifiedIcon fontSize="inherit" />}>
              Ja, op {new Date(delivery.deliveredAt).toLocaleString("nl-NL")} naar {delivery.recipientRefs.length}{" "}
              betrokkene(n): {delivery.recipientRefs.join(", ")}. Dat staat als regel {delivery.logIndex} (
              <code>logboek_verstuurd</code>) in de keten, dus of jij het hoort te krijgen is geen kwestie van
              welles-nietes meer. Er staan alleen pseudonieme verwijzingen in, geen adressen.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nog niet. Zodra de procedure een eindstatus bereikt, gaat het logboek vanzelf naar alle betrokkenen. Je
              hoeft er niet om te vragen.
            </Typography>
          )}

          <Divider textAlign="left">
            <Typography variant="overline">Zelf controleren</Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            Elke regel hierboven bevat de hash van de regel ervóór. Wie achteraf iets wijzigt, invoegt of weghaalt,
            breekt die keten op een zichtbare plek. Met de knop hieronder rekent <em>jouw browser</em> de hele keten
            opnieuw uit. Je hoeft deze server dus niet te geloven: je controleert zijn huiswerk.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Button variant="outlined" onClick={onVerify}>
              Controleer zelf of er niets gewijzigd is
            </Button>
            <Button variant="text" startIcon={<DownloadIcon />} onClick={downloadLogbook}>
              Download logboek.json
            </Button>
          </Stack>
          {chainCheck && (
            <Alert severity={chainCheck.valid ? "success" : "error"}>
              {chainCheck.valid
                ? "De keten klopt: geen enkele regel is gewijzigd, ingevoegd of verwijderd."
                : `De keten breekt bij regel ${chainCheck.firstBrokenIndex}.`}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Wat deze controle <strong>niet</strong> zegt: of dit logboek echt van deze instantie komt. Daarvoor is de
            handtekening onderaan het logboek nodig, en die kun je alleen buiten de browser natrekken. Download het
            logboek en draai <code>openbod-verify logbook logboek.json</code> uit <code>packages/verifier</code>; dat
            controleert de keten, de root-hash én de handtekening.
          </Typography>
        </Sectie>
      )}
    </Stack>
  );
}
