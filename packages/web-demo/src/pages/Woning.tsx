import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
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
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import {
  coreApi,
  getToken,
  type Listing,
  type Logbook,
  type MyBid,
  type OvernameStatus,
  type TakeoverItem,
} from "../lib/api";
import { sealBid, type OvernameChoice, type Voorbehoud } from "../lib/seal";
import { sealIdentity } from "../lib/identity-envelope";
import { Aftelklok } from "../components/Aftelklok";
import { Bewijspaneel } from "../components/Bewijspaneel";
import { Fotogalerij } from "../components/Fotogalerij";
import { Kenmerkenblok } from "../components/Kenmerkenblok";
import { Sectie } from "../components/Sectie";
import { StatusChip } from "../components/StatusChip";

const VOORBEHOUD_LABELS: { type: Voorbehoud["type"]; label: string; uitleg: string }[] = [
  {
    type: "financieel",
    label: "Financieringsvoorbehoud",
    uitleg: "Je bod vervalt als je de hypotheek niet rond krijgt.",
  },
  { type: "bouwdepot", label: "Bouwdepot", uitleg: "Je hebt een hypotheek met bouwdepot nodig." },
  { type: "bouwkundige_keuring", label: "Bouwkundige keuring", uitleg: "Je bod hangt af van de uitkomst." },
  { type: "verkoop_eigen_woning", label: "Verkoop eigen woning", uitleg: "Je moet eerst je huidige woning verkopen." },
  { type: "nhg", label: "NHG", uitleg: "Je hebt Nationale Hypotheek Garantie nodig." },
  { type: "anders", label: "Anders", uitleg: "Licht hieronder toe wat je bedoelt." },
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

const PRIJSVORM_LABELS: Record<Listing["prijsVorm"], string> = {
  vraagprijs: "Vraagprijs",
  richtprijs: "Richtprijs",
  bieden_vanaf: "Bieden vanaf",
};

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
  return value ? new Date(value).toLocaleDateString("nl-NL") : "-";
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

export function Woning() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(0);
  const [motivation, setMotivation] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [conditions, setConditions] = useState<Record<string, VoorbehoudState>>({});
  const [takeover, setTakeover] = useState<Record<string, TakeoverState>>({});
  const [sealing, setSealing] = useState(false);
  const [myBid, setMyBid] = useState<MyBid | null>(null);
  const [bidderName, setBidderName] = useState("");
  const [bidderContact, setBidderContact] = useState("");
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
        // Een zinnig startbedrag scheelt de bezoeker rekenwerk, maar overschrijf
        // niet wat hij zelf al intypte.
        setAmount((huidig) => (huidig === 0 && l.askingPrice ? l.askingPrice : huidig));
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
      return { type: v.type, deadline: dateToIso(state.deadline), note: state.note.trim() || undefined };
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

  async function onBid() {
    if (!id || !listing) return;
    if (!getToken()) {
      setError("Log eerst in. Dat is nodig zodat één persoon niet twintig biedingen kan doen.");
      return;
    }
    const payload = buildBidPayload();
    if (!(payload.amount > 0)) {
      setError("Vul een bedrag in.");
      return;
    }
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
      // inhoud: de server kan het oude bod niet lezen, dus er valt niets te
      // wijzigen behalve het geheel. Het logboek houdt beide versies vast.
      const res = myBid
        ? await coreApi.adjustBid(id, myBid.bidId, commitment, ciphertext, identityEnvelope)
        : await coreApi.placeBid(id, commitment, ciphertext, identityEnvelope);
      setMyBid({
        ...res,
        version: (myBid?.version ?? 0) + 1,
        createdAt: myBid?.createdAt ?? res.timestamp,
        updatedAt: res.timestamp,
      });
      setZojuistGeboden(true);
      setFormulierOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(String(err));
    } finally {
      setSealing(false);
    }
  }

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

  const biedbareItems = listing.takeoverItems.filter((item) => choicesFor(item.status).length > 0);
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

      {listing.omschrijving && (
        <Sectie titel="Over deze woning">
          <Typography sx={{ whiteSpace: "pre-line", maxWidth: "70ch" }}>{listing.omschrijving}</Typography>
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

      {toonFormulier && (
        <Sectie
          titel={myBid ? "Je bod aanpassen" : "Een bod uitbrengen"}
          toelichting="Je hele bod wordt op dit apparaat versleuteld voordat het wordt verstuurd. Deze website ontvangt alleen een onleesbaar pakket en kan het pas op de sluitingstijd openen, tegelijk met iedereen."
        >
          {!getToken() && (
            <Alert severity="info">
              Je bent niet ingelogd.{" "}
              <RouterLink to="/login">Log eerst in</RouterLink> zodat je bod aan jou gekoppeld kan worden.
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              label="Jouw bod"
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
              helperText="Wat je hier invult is voor niemand zichtbaar tot de sluitingstijd."
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
                label="Mijn bod geldt tot"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline">Voorbehouden</Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            De verkoper ziet welke voorbehouden je maakt, zonder waardeoordeel erbij. Hij weegt zelf zekerheid tegen
            hoogte.
          </Typography>
          <Stack spacing={0.5}>
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
                    label={
                      <Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {v.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {v.uitleg}
                        </Typography>
                      </Stack>
                    }
                  />
                  {state.selected && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pl: 4, py: 1 }}>
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
                <Typography variant="overline">Roerende zaken</Typography>
              </Divider>
              <Stack spacing={2}>
                {biedbareItems.map((item) => {
                  const state = takeoverState(item);
                  return (
                    <Stack key={item.itemId} direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        select
                        label={item.amount !== undefined ? `${item.label} (gevraagd ${euro(item.amount)})` : item.label}
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

          <Divider textAlign="left">
            <Typography variant="overline">Over jou</Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            Je naam wordt apart versleuteld, naar de verkoper persoonlijk. Deze website kan hem niet lezen, de makelaar
            ook niet, en de verkoper pas op het moment dat hij aan jou gunt. In het openbare logboek verschijnt hij
            nooit. Een korte motivatie mag, en die leest alleen de verkoper.
          </Typography>
          <Stack spacing={2}>
            {listing.sellerPublicKey && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Naam" value={bidderName} onChange={(e) => setBidderName(e.target.value)} />
                <TextField
                  label="Contact (optioneel)"
                  placeholder="e-mail of telefoon"
                  value={bidderContact}
                  onChange={(e) => setBidderContact(e.target.value)}
                />
              </Stack>
            )}
            <TextField
              label="Motivatie (optioneel)"
              multiline
              minRows={3}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              helperText="Alleen de verkoper leest dit. Andere bieders zien het niet en het komt niet in het openbare logboek."
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" size="large" startIcon={<LockIcon />} onClick={onBid} disabled={sealing}>
              {sealing ? "Versleutelen…" : myBid ? "Aangepast bod versturen" : "Bod versleuteld versturen"}
            </Button>
            {myBid && (
              <Button variant="text" onClick={() => setFormulierOpen(false)} disabled={sealing}>
                Annuleren
              </Button>
            )}
          </Stack>
        </Sectie>
      )}

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
