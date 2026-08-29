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
import { coreApi, type OvernameStatus } from "../lib/api";
import { generateSellerKeypair, saveSellerKey } from "../lib/identity-envelope";
import { Sectie } from "../components/Sectie";

const STATUS_OPTIONS: { value: OvernameStatus; label: string }[] = [
  { value: "blijft_achter", label: "Blijft achter" },
  { value: "gevraagd_bedrag", label: "Ter overname voor een vast bedrag" },
  { value: "in_overleg", label: "Ter overname, in overleg" },
  { value: "niet_beschikbaar", label: "Niet beschikbaar" },
];

interface ItemDraft {
  label: string;
  status: OvernameStatus;
  amount: string;
}

const EMPTY_ITEM: ItemDraft = { label: "", status: "in_overleg", amount: "" };

export function CreateListing() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("Voorbeeldstraat 1, Amsterdam");
  const [askingPrice, setAskingPrice] = useState(500000);
  const [minutesFromNow, setMinutesFromNow] = useState(2);
  const [intrekkenToegestaan, setIntrekken] = useState(true);
  const [aanpassenToegestaan, setAanpassen] = useState(true);
  const [aantalBiedingenZichtbaar, setAantalZichtbaar] = useState(true);
  const [items, setItems] = useState<ItemDraft[]>([
    { label: "Gordijnen woonkamer", status: "in_overleg", amount: "" },
    { label: "Wasmachine", status: "gevraagd_bedrag", amount: "200" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const deadline = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
      // Het sleutelpaar van de verkoper ontstaat hier, in zijn eigen browser. Alleen
      // de publieke helft gaat mee naar de server; met de private helft kan hij straks
      // de identiteit van de bieder aan wie hij gunt openen, en niemand anders.
      const { publicJwk, privateJwk } = await generateSellerKeypair();
      const listing = await coreApi.createListing({
        address,
        prijsVorm: "vraagprijs",
        askingPrice,
        verkoopmethode: "bieden_met_deadline",
        deadline,
        rules: { intrekkenToegestaan, aanpassenToegestaan, aantalBiedingenZichtbaar },
        takeoverItems: items
          .filter((item) => item.label.trim())
          .map((item) => ({
            label: item.label.trim(),
            status: item.status,
            // Alleen een vast bedrag heeft een bedrag; bij "in overleg" bepaalt de bieder.
            amount: item.status === "gevraagd_bedrag" && item.amount ? Number(item.amount) : undefined,
          })),
        sellerPublicKey: publicJwk,
      });
      saveSellerKey(listing.id, privateJwk);
      navigate(`/woningen/${listing.id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" onSubmit={onSubmit} spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Woning aanmaken</Typography>
        <Alert severity="info" icon={<KeyIcon fontSize="inherit" />}>
          <AlertTitle>Je browser maakt zo een sleutelpaar aan</AlertTitle>
          Bieders versleutelen hun naam naar de publieke helft, zodat deze server en de makelaar nooit zien wie er
          biedt. Pas als je gunt, kun jij die naam openen met de private helft, die in deze browser blijft. Raak je die
          kwijt, dan blijft de naam onleesbaar. Dat is geen bug maar de hele garantie.
        </Alert>
      </Stack>

      <Sectie titel="De woning">
        <Stack spacing={2}>
          <TextField label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} required />
          <TextField
            label="Vraagprijs"
            type="number"
            value={askingPrice}
            onChange={(e) => setAskingPrice(Number(e.target.value))}
            required
            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
          />
          <TextField
            label="Sluit over (minuten)"
            type="number"
            slotProps={{ htmlInput: { min: 1 } }}
            value={minutesFromNow}
            onChange={(e) => setMinutesFromNow(Number(e.target.value))}
            required
            helperText="Kort houden voor de demo. Een drand quicknet-ronde duurt 3 seconden, dus de onthulling is snel te zien."
          />
        </Stack>
      </Sectie>

      <Sectie
        titel="Spelregels"
        toelichting="Deze staan vanaf nu vast en gelden voor iedereen gelijk. Ze zijn ook zichtbaar voor bieders, want spelregels die halverwege kunnen veranderen zijn geen spelregels."
      >
        <Stack>
          <FormControlLabel
            control={<Checkbox checked={intrekkenToegestaan} onChange={(e) => setIntrekken(e.target.checked)} />}
            label="Bieder mag zijn bod vóór de deadline intrekken"
          />
          <FormControlLabel
            control={<Checkbox checked={aanpassenToegestaan} onChange={(e) => setAanpassen(e.target.checked)} />}
            label="Bieder mag zijn bod vóór de deadline aanpassen"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={aantalBiedingenZichtbaar}
                onChange={(e) => setAantalZichtbaar(e.target.checked)}
              />
            }
            label="Aantal biedingen is zichtbaar (bedragen nooit, tot de deadline)"
          />
        </Stack>
      </Sectie>

      <Sectie
        titel="Roerende zaken"
        toelichting="Wat kan de koper overnemen? De bieder kiest hier straks per item, en die keuze zit mee in het verzegelde bod. Zo wordt het onderdeel van de afweging in plaats van iets dat er los achteraan komt."
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
              Geen roerende zaken opgegeven. Bieders zien dan alleen de woning zelf.
            </Typography>
          )}
        </Stack>
      </Sectie>

      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? "Sleutelpaar maken en aanmaken…" : "Woning aanmaken"}
        </Button>
      </Box>
    </Stack>
  );
}
