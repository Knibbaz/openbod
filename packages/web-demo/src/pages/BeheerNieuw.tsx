import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import KeyIcon from "@mui/icons-material/VpnKeyOutlined";
import { coreApi, type Energielabel, type OvernameStatus } from "../lib/api";
import { generateSellerKeypair, saveSellerKey } from "../lib/identity-envelope";
import { Fotogalerij } from "../components/Fotogalerij";
import { Sectie } from "../components/Sectie";

const STATUS_OPTIONS: { value: OvernameStatus; label: string }[] = [
  { value: "blijft_achter", label: "Blijft achter" },
  { value: "gevraagd_bedrag", label: "Ter overname voor een vast bedrag" },
  { value: "in_overleg", label: "Ter overname, in overleg" },
  { value: "niet_beschikbaar", label: "Niet beschikbaar" },
];

const PRIJSVORMEN = [
  { value: "vraagprijs", label: "Vraagprijs" },
  { value: "richtprijs", label: "Richtprijs" },
  { value: "bieden_vanaf", label: "Bieden vanaf" },
] as const;

const VERKOOPMETHODEN = [
  { value: "inschrijving", label: "Inschrijving bij een notaris of makelaar" },
  { value: "bieden_met_deadline", label: "Bieden tot een sluitingstijd" },
  { value: "onderhandeling", label: "Onderhandeling" },
] as const;

const ENERGIELABELS: Energielabel[] = ["A++++", "A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"];

interface ItemDraft {
  label: string;
  status: OvernameStatus;
  amount: string;
}

const EMPTY_ITEM: ItemDraft = { label: "", status: "in_overleg", amount: "" };

/** Standaard over twee dagen, op een heel uur. Realistischer dan "over 2 minuten". */
function standaardSluiting(): string {
  const d = new Date(Date.now() + 2 * 86_400_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** Getalveld dat leeg mag blijven; lege kenmerken horen niet als 0 in het dossier. */
function optioneelGetal(waarde: string): number | undefined {
  const n = Number(waarde);
  return waarde.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function BeheerNieuw() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [prijsVorm, setPrijsVorm] = useState<(typeof PRIJSVORMEN)[number]["value"]>("vraagprijs");
  const [askingPrice, setAskingPrice] = useState("");
  const [verkoopmethode, setVerkoopmethode] = useState<(typeof VERKOOPMETHODEN)[number]["value"]>("inschrijving");
  const [sluiting, setSluiting] = useState(standaardSluiting);
  const [omschrijving, setOmschrijving] = useState("");

  const [woonoppervlak, setWoonoppervlak] = useState("");
  const [perceeloppervlak, setPerceel] = useState("");
  const [kamers, setKamers] = useState("");
  const [slaapkamers, setSlaapkamers] = useState("");
  const [bouwjaar, setBouwjaar] = useState("");
  const [energielabel, setEnergielabel] = useState<Energielabel | "">("");

  const [fotoInvoer, setFotoInvoer] = useState("");
  const [intrekkenToegestaan, setIntrekken] = useState(true);
  const [aanpassenToegestaan, setAanpassen] = useState(true);
  const [aantalBiedingenZichtbaar, setAantalZichtbaar] = useState(true);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Eén URL per regel is voor een makelaar met een bestaande fotoreeks het
  // snelste; deze instantie host zelf geen bestanden.
  const fotos = fotoInvoer
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  function setItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const deadlineMs = new Date(sluiting).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      setError("Kies een sluitingstijd die in de toekomst ligt.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Het sleutelpaar van de verkoper ontstaat hier, in zijn eigen browser. Alleen
      // de publieke helft gaat mee naar de server; met de private helft kan hij straks
      // de identiteit van de bieder aan wie hij gunt openen, en niemand anders.
      const { publicJwk, privateJwk } = await generateSellerKeypair();
      const kenmerken = {
        woonoppervlak: optioneelGetal(woonoppervlak),
        perceeloppervlak: optioneelGetal(perceeloppervlak),
        kamers: optioneelGetal(kamers),
        slaapkamers: optioneelGetal(slaapkamers),
        bouwjaar: optioneelGetal(bouwjaar),
        energielabel: energielabel || undefined,
      };
      const listing = await coreApi.createListing({
        address,
        prijsVorm,
        askingPrice: optioneelGetal(askingPrice),
        verkoopmethode,
        deadline: new Date(deadlineMs).toISOString(),
        rules: { intrekkenToegestaan, aanpassenToegestaan, aantalBiedingenZichtbaar },
        takeoverItems: items
          .filter((item) => item.label.trim())
          .map((item) => ({
            label: item.label.trim(),
            status: item.status,
            // Alleen een vast bedrag heeft een bedrag; bij "in overleg" bepaalt de bieder.
            amount: item.status === "gevraagd_bedrag" && item.amount ? Number(item.amount) : undefined,
          })),
        fotos,
        omschrijving: omschrijving.trim() || undefined,
        kenmerken: Object.values(kenmerken).some((v) => v !== undefined) ? kenmerken : undefined,
        sellerPublicKey: publicJwk,
      });
      saveSellerKey(listing.id, privateJwk);
      navigate(`/beheer/${listing.id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={onSubmit} spacing={3}>
      <Typography variant="h1">Woning klaarzetten</Typography>

      <Alert severity="info" icon={<KeyIcon fontSize="inherit" />}>
        <AlertTitle>Dit apparaat maakt zo een sleutel aan</AlertTitle>
        Bieders versleutelen hun naam naar die sleutel, zodat deze website en de makelaar tijdens de inschrijving nooit
        zien wie er biedt. Pas als je gunt, open jij die naam. De sleutel blijft in deze browser en wordt nergens
        anders bewaard. Raak je hem kwijt, dan blijft de naam onleesbaar. Dat is geen gebrek maar de hele garantie.
      </Alert>

      <Sectie titel="De woning">
        <Stack spacing={2}>
          <TextField
            label="Adres"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="Straatnaam 1, Plaats"
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Prijsvorm" value={prijsVorm} onChange={(e) => setPrijsVorm(e.target.value as typeof prijsVorm)}>
              {PRIJSVORMEN.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bedrag"
              type="number"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
            />
          </Stack>
          <TextField
            select
            label="Verkoopmethode"
            value={verkoopmethode}
            onChange={(e) => setVerkoopmethode(e.target.value as typeof verkoopmethode)}
          >
            {VERKOOPMETHODEN.map((v) => (
              <MenuItem key={v.value} value={v.value}>
                {v.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Sluitingstijd"
            type="datetime-local"
            value={sluiting}
            onChange={(e) => setSluiting(e.target.value)}
            required
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Op dit moment gaan alle biedingen tegelijk open. Ook jij kunt ze niet eerder inzien."
          />
          <TextField
            label="Omschrijving"
            multiline
            minRows={4}
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            placeholder="Wat moet een koper over deze woning weten?"
          />
        </Stack>
      </Sectie>

      <Sectie
        titel="Kenmerken"
        toelichting="Laat leeg wat je niet weet. Deze gegevens gaan mee in de vastlegging, zodat achteraf aantoonbaar is waarop er geboden werd."
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Woonoppervlak"
            type="number"
            value={woonoppervlak}
            onChange={(e) => setWoonoppervlak(e.target.value)}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">m²</InputAdornment> } }}
          />
          <TextField
            label="Perceel"
            type="number"
            value={perceeloppervlak}
            onChange={(e) => setPerceel(e.target.value)}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">m²</InputAdornment> } }}
          />
          <TextField label="Bouwjaar" type="number" value={bouwjaar} onChange={(e) => setBouwjaar(e.target.value)} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label="Kamers" type="number" value={kamers} onChange={(e) => setKamers(e.target.value)} />
          <TextField
            label="Slaapkamers"
            type="number"
            value={slaapkamers}
            onChange={(e) => setSlaapkamers(e.target.value)}
          />
          <TextField
            select
            label="Energielabel"
            value={energielabel}
            onChange={(e) => setEnergielabel(e.target.value as Energielabel | "")}
          >
            <MenuItem value="">Onbekend</MenuItem>
            {ENERGIELABELS.map((l) => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Sectie>

      <Sectie
        titel="Foto's"
        toelichting="Eén https-adres per regel. Deze instantie bewaart zelf geen bestanden, dus je verwijst naar de foto's zoals ze al ergens staan."
      >
        <TextField
          label="Foto-adressen"
          multiline
          minRows={3}
          value={fotoInvoer}
          onChange={(e) => setFotoInvoer(e.target.value)}
          placeholder={"https://voorbeeld.nl/woonkamer.jpg\nhttps://voorbeeld.nl/tuin.jpg"}
        />
        {fotos.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Zo komt het er voor een koper uit te zien:
            </Typography>
            <Fotogalerij fotos={fotos} alt={address || "Voorbeeld"} />
          </Box>
        )}
      </Sectie>

      <Sectie
        titel="Spelregels"
        toelichting="Deze staan vanaf het klaarzetten vast en gelden voor iedereen gelijk. Bieders zien ze, want spelregels die halverwege kunnen veranderen zijn geen spelregels."
      >
        <Stack>
          <FormControlLabel
            control={<Checkbox checked={intrekkenToegestaan} onChange={(e) => setIntrekken(e.target.checked)} />}
            label="Een bieder mag zijn bod vóór de sluitingstijd intrekken"
          />
          <FormControlLabel
            control={<Checkbox checked={aanpassenToegestaan} onChange={(e) => setAanpassen(e.target.checked)} />}
            label="Een bieder mag zijn bod vóór de sluitingstijd aanpassen"
          />
          <FormControlLabel
            control={
              <Checkbox checked={aantalBiedingenZichtbaar} onChange={(e) => setAantalZichtbaar(e.target.checked)} />
            }
            label="Het aantal biedingen is zichtbaar (bedragen nooit, tot de sluitingstijd)"
          />
        </Stack>
      </Sectie>

      <Sectie
        titel="Roerende zaken"
        toelichting="Wat blijft achter en wat kan de koper overnemen? De bieder kiest hier per item, en die keuze zit mee in het verzegelde bod."
        actie={
          <Button
            type="button"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
          >
            Item
          </Button>
        }
      >
        <Stack spacing={1.5}>
          {items.map((item, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <TextField
                  label="Item"
                  placeholder="bijv. Tuinset"
                  value={item.label}
                  onChange={(e) => setItem(i, { label: e.target.value })}
                />
                <TextField
                  select
                  label="Status"
                  value={item.status}
                  onChange={(e) => setItem(i, { status: e.target.value as OvernameStatus })}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
                {item.status === "gevraagd_bedrag" && (
                  <TextField
                    label="Gevraagd"
                    type="number"
                    slotProps={{
                      htmlInput: { min: 0 },
                      input: { startAdornment: <InputAdornment position="start">€</InputAdornment> },
                    }}
                    value={item.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })}
                  />
                )}
                <Tooltip title="Item verwijderen">
                  <IconButton
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Item ${item.label || i + 1} verwijderen`}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
          {items.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nog geen roerende zaken opgegeven.
            </Typography>
          )}
        </Stack>
      </Sectie>

      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? "Sleutel maken en klaarzetten…" : "Woning klaarzetten"}
        </Button>
      </Box>
    </Stack>
  );
}
