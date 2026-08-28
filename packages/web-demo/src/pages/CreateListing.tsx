import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { coreApi, type OvernameStatus } from "../lib/api";
import { generateSellerKeypair, saveSellerKey } from "../lib/identity-envelope";

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
    <div>
      <h1>Woning aanmaken</h1>
      <p>
        Bij het aanmaken genereert je browser een sleutelpaar. Bieders versleutelen hun naam daarnaartoe, zodat deze
        server en de makelaar nooit zien wie er biedt. Pas als je gunt, kun jij die naam openen — met de sleutel die in
        deze browser blijft. Raak je die kwijt, dan blijft de naam onleesbaar.
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Adres
          <input value={address} onChange={(e) => setAddress(e.target.value)} required />
        </label>
        <label>
          Vraagprijs (EUR)
          <input type="number" value={askingPrice} onChange={(e) => setAskingPrice(Number(e.target.value))} required />
        </label>
        <label>
          Sluit over (minuten) — kort voor de demo, drand quicknet-ronde is 3s
          <input
            type="number"
            min={1}
            value={minutesFromNow}
            onChange={(e) => setMinutesFromNow(Number(e.target.value))}
            required
          />
        </label>

        <h2>Spelregels</h2>
        <p>Deze staan vooraf vast en gelden voor iedereen gelijk.</p>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={intrekkenToegestaan} onChange={(e) => setIntrekken(e.target.checked)} />
          Bieder mag zijn bod vóór de deadline intrekken
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={aanpassenToegestaan} onChange={(e) => setAanpassen(e.target.checked)} />
          Bieder mag zijn bod vóór de deadline aanpassen
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={aantalBiedingenZichtbaar}
            onChange={(e) => setAantalZichtbaar(e.target.checked)}
          />
          Aantal biedingen is zichtbaar (bedragen nooit, tot de deadline)
        </label>

        <h2>Roerende zaken</h2>
        <p>Wat kan de koper overnemen? De bieder kiest hier straks per item.</p>
        {items.map((item, i) => (
          <div key={i}>
            <label>
              Item
              <input
                value={item.label}
                placeholder="bijv. Tuinset"
                onChange={(e) => setItem(i, { label: e.target.value })}
              />
            </label>
            <label>
              Status
              <select value={item.status} onChange={(e) => setItem(i, { status: e.target.value as OvernameStatus })}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {item.status === "gevraagd_bedrag" && (
              <label>
                Gevraagd bedrag (EUR)
                <input type="number" min={0} value={item.amount} onChange={(e) => setItem(i, { amount: e.target.value })} />
              </label>
            )}
            <button type="button" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>
              Verwijderen
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          Item toevoegen
        </button>

        <button type="submit" disabled={submitting}>
          {submitting ? "Bezig…" : "Aanmaken"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </div>
  );
}
