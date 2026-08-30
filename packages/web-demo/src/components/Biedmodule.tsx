import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DraftIcon from "@mui/icons-material/EditNoteOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import { coreApi, getToken, type Listing, type MyBid, type TakeoverItem } from "../lib/api";
import { sealBid, type OvernameChoice, type Voorbehoud } from "../lib/seal";
import { sealIdentity } from "../lib/identity-envelope";
import { clearConcept, loadConcept, saveConcept, type Concept } from "../lib/concept";
import { CHOICE_LABELS, VOORBEHOUD_LABELS, choicesFor, dateToIso, euro } from "../lib/biedlabels";
import { isVeiligeContext } from "./Onveiligebanner";
import { Sectie } from "./Sectie";

/**
 * Alles wat het bod in leesbare vorm aanraakt, op één plek.
 *
 * Deze grens is geen opruimwerk maar de voorbereiding op E9-S5. Een makelaar
 * wil zijn eigen kleuren en teksten, dus een hash over de hele frontend zegt
 * niets: die is bij elke instantie anders. Wat wél te certificeren valt, is het
 * kleine stuk waar het bedrag doorheen gaat, precies zoals een webwinkel zijn
 * afrekenpagina naar eigen smaak inricht terwijl het pasnummer door een
 * afgeschermd onderdeel van de betaaldienst gaat.
 *
 * Daarom hoort hier alles binnen wat de bieder invult voordat het verzegeld is:
 * het bedrag, de voorbehouden, de roerende zaken, de motivatie, de naam, en het
 * concept. Naar buiten gaat uitsluitend het ontvangstbewijs, en dat bevat geen
 * enkel leesbaar gegeven uit het bod.
 *
 * Wie hier iets aan toevoegt: een nieuw veld dat de bieder invult, hoort binnen
 * deze module en niet op de pagina eromheen. Het pseudonieme profiel uit E7-S4
 * is het eerstvolgende voorbeeld.
 */
export interface BiedmoduleProps {
  listing: Listing;
  myBid: MyBid | null;
  /** Staat het formulier open? De pagina beslist dat, want zij kent de knoppen eromheen. */
  open: boolean;
  onOpenen: () => void;
  onSluiten: () => void;
  /** Het ontvangstbewijs, het enige dat deze module naar buiten geeft. */
  onGeplaatst: (bod: MyBid) => void;
  onFout: (melding: string) => void;
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

/** Een bedrag is geld, geen willekeurig getal: hooguit twee cijfers achter de komma. */
function isHeleCenten(bedrag: number): boolean {
  return Number.isFinite(bedrag) && Math.abs(bedrag * 100 - Math.round(bedrag * 100)) < 1e-9;
}

export function Biedmodule({ listing, myBid, open, onOpenen, onSluiten, onGeplaatst, onFout }: BiedmoduleProps) {
  const [amount, setAmount] = useState(0);
  const [motivation, setMotivation] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [conditions, setConditions] = useState<Record<string, VoorbehoudState>>({});
  const [takeover, setTakeover] = useState<Record<string, TakeoverState>>({});
  const [bidderName, setBidderName] = useState("");
  const [bidderContact, setBidderContact] = useState("");
  const [sealing, setSealing] = useState(false);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [conceptTeruggezet, setConceptTeruggezet] = useState(false);

  const magBieden = listing.status === "biedfase";

  // Een zinnig startbedrag scheelt de bezoeker rekenwerk, maar overschrijf niet
  // wat hij zelf al intypte.
  useEffect(() => {
    setAmount((huidig) => (huidig === 0 && listing.askingPrice ? listing.askingPrice : huidig));
  }, [listing.askingPrice]);

  // Een bewaard concept terugzetten, zodat je verder gaat waar je gebleven was.
  useEffect(() => {
    if (!magBieden) return;
    let cancelled = false;
    void (async () => {
      const bewaard = await loadConcept(listing.id);
      if (!bewaard || cancelled) return;
      setConcept(bewaard);
      setAmount(bewaard.amount);
      setMotivation(bewaard.motivation);
      setHandoverDate(bewaard.handoverDate);
      setValidUntil(bewaard.validUntil);
      setConditions(bewaard.conditions);
      setTakeover(bewaard.takeover as Record<string, TakeoverState>);
      setBidderName(bewaard.bidderName);
      setBidderContact(bewaard.bidderContact);
      setConceptTeruggezet(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [listing.id, magBieden]);

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

    const chosenTakeover: OvernameChoice[] = listing.takeoverItems
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

  async function onSaveConcept() {
    if (!getToken()) {
      onFout("Log eerst in. Een concept wordt bij je account bewaard, zodat het er op een ander apparaat ook nog staat.");
      return;
    }
    try {
      setConcept(
        await saveConcept(listing.id, {
          amount,
          motivation,
          handoverDate,
          validUntil,
          conditions,
          takeover,
          bidderName,
          bidderContact,
        }),
      );
      setConceptTeruggezet(false);
    } catch (err) {
      onFout(String(err));
    }
  }

  async function onClearConcept() {
    if (!confirm("Je concept wissen? Wat je invulde is daarna weg.")) return;
    await clearConcept(listing.id);
    setConcept(null);
    setConceptTeruggezet(false);
  }

  async function onBid() {
    if (!isVeiligeContext()) {
      onFout(
        "Je bod kan hier niet versleuteld worden: deze pagina draait niet over https, en dan geeft je browser zijn " +
          "cryptografie niet vrij. Een onversleuteld bod versturen doen we niet.",
      );
      return;
    }
    if (!getToken()) {
      onFout("Log eerst in. Dat is nodig zodat één persoon niet twintig biedingen kan doen.");
      return;
    }
    const payload = buildBidPayload();
    if (!(payload.amount > 0)) {
      onFout("Vul een bedrag in.");
      return;
    }
    const eigenBodZonderBedrag = payload.takeover.some(
      (t) => t.choice === "eigen_bod" && !(typeof t.amount === "number" && t.amount > 0),
    );
    if (eigenBodZonderBedrag) {
      onFout("Vul een bedrag in bij elk item waarvoor je een eigen bod doet.");
      return;
    }
    // Hier controleren en niet bij de onthulling. Het bedrag gaat straks de
    // commitment in en is daarna onveranderlijk; een bod dat pas bij het openen
    // op zijn vorm wordt afgekeurd, is een bod dat verdwijnt terwijl het gewoon
    // klopt met zijn commitment. Wat nooit verzegeld wordt, hoeft ook nooit
    // afgekeurd te worden.
    const bedragen = [payload.amount, ...payload.takeover.map((t) => t.amount)].filter(
      (n): n is number => typeof n === "number",
    );
    if (bedragen.some((n) => !isHeleCenten(n))) {
      onFout("Bedragen mogen niet meer dan twee cijfers achter de komma hebben.");
      return;
    }
    if (listing.sellerPublicKey && !bidderName.trim()) {
      onFout("Vul je naam in. Die gaat versleuteld mee en is alleen leesbaar voor de verkoper, ná gunning.");
      return;
    }
    setSealing(true);
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
        ? await coreApi.adjustBid(listing.id, myBid.bidId, commitment, ciphertext, identityEnvelope)
        : await coreApi.placeBid(listing.id, commitment, ciphertext, identityEnvelope);
      // Het concept heeft zijn werk gedaan: er staat nu een echt bod. De server
      // gooit hem ook zelf weg, dit houdt het scherm gelijk.
      setConcept(null);
      setConceptTeruggezet(false);
      onGeplaatst({
        ...res,
        version: (myBid?.version ?? 0) + 1,
        createdAt: myBid?.createdAt ?? res.timestamp,
        updatedAt: res.timestamp,
      });
    } catch (err) {
      onFout(String(err));
    } finally {
      setSealing(false);
    }
  }

  if (!magBieden) return null;

  if (!open) {
    if (!concept) return null;
    return (
      <Sectie
        titel="Je hebt een concept klaarstaan"
        toelichting="Een concept is nog geen bod: het staat niet in het logboek en telt nergens mee. Het wordt bij je account bewaard, zodat het er op een ander apparaat ook staat. Anders dan een verzegeld bod is een concept niet versleuteld, dus wie deze website beheert kan het lezen. Verstuur je bod als je het zeker weet."
      >
        <Typography variant="body2" color="text.secondary">
          Laatst bewaard op {new Date(concept.savedAt).toLocaleString("nl-NL")}
          {concept.amount > 0 && <> · bedrag {euro(concept.amount)}</>}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Button variant="contained" onClick={onOpenen}>
            Verder met mijn concept
          </Button>
          <Button color="error" variant="outlined" onClick={onClearConcept}>
            Concept wissen
          </Button>
        </Stack>
      </Sectie>
    );
  }

  const biedbareItems = listing.takeoverItems.filter((item) => choicesFor(item.status).length > 0);

  return (
    <Sectie
      titel={myBid ? "Je bod aanpassen" : "Een bod uitbrengen"}
      toelichting="Je hele bod wordt op dit apparaat versleuteld voordat het wordt verstuurd. Deze website ontvangt alleen een onleesbaar pakket en kan het pas op de sluitingstijd openen, tegelijk met iedereen."
    >
      {conceptTeruggezet && concept && (
        <Alert severity="info" icon={<DraftIcon fontSize="inherit" />} onClose={() => setConceptTeruggezet(false)}>
          Je bewaarde concept van {new Date(concept.savedAt).toLocaleString("nl-NL")} staat weer ingevuld. Er is nog
          niets verstuurd.
        </Alert>
      )}

      {!getToken() && (
        <Alert severity="info">
          Je bent niet ingelogd. <RouterLink to="/login">Log eerst in</RouterLink> zodat je bod aan jou gekoppeld kan
          worden.
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
        ook niet, en de verkoper pas op het moment dat hij aan jou gunt. In het openbare logboek verschijnt hij nooit.
        Een korte motivatie mag, en die leest alleen de verkoper.
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
        <Button
          variant="contained"
          size="large"
          startIcon={<LockIcon />}
          onClick={onBid}
          disabled={sealing || !isVeiligeContext()}
        >
          {sealing ? "Versleutelen…" : myBid ? "Aangepast bod versturen" : "Bod versleuteld versturen"}
        </Button>
        <Button variant="outlined" size="large" startIcon={<DraftIcon />} onClick={onSaveConcept} disabled={sealing}>
          Bewaar als concept
        </Button>
        {myBid && (
          <Button variant="text" onClick={onSluiten} disabled={sealing}>
            Annuleren
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Nu versturen kost je niets: je bod is onleesbaar tot de sluitingstijd, ook voor de makelaar en voor deze
        website, en je krijgt meteen je ontvangstbewijs. Aanpassen mag daarna nog steeds zolang de inschrijving
        openstaat.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Bewaren als concept verstuurt geen bod. Het wordt bij je account bewaard, zodat je later op elk apparaat verder
        kunt als je eerst nog moet bellen of overleggen. Let op: een concept is niet versleuteld, dus wie deze website
        beheert kan het lezen. Die bescherming krijg je pas als je het bod versleuteld verstuurt, en dan telt het mee
        en komt het in het logboek.
      </Typography>
    </Sectie>
  );
}
