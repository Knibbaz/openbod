import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { coreApi } from "../lib/api";

export function CreateListing() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("Voorbeeldstraat 1, Amsterdam");
  const [askingPrice, setAskingPrice] = useState(500000);
  const [minutesFromNow, setMinutesFromNow] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const deadline = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
      const listing = await coreApi.createListing({
        address,
        prijsVorm: "vraagprijs",
        askingPrice,
        verkoopmethode: "bieden_met_deadline",
        deadline,
        rules: { intrekkenToegestaan: true, aanpassenToegestaan: true, aantalBiedingenZichtbaar: true },
        takeoverItems: [{ label: "Gordijnen woonkamer", status: "in_overleg" }],
      });
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
        <button type="submit" disabled={submitting}>
          {submitting ? "Bezig…" : "Aanmaken"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </div>
  );
}
