import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { coreApi, getToken, type Listing, type Logbook } from "../lib/api";
import { sealBid } from "../lib/seal";
import { verifyHashChainInBrowser } from "../lib/verify";

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [logbook, setLogbook] = useState<Logbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(510000);
  const [motivation, setMotivation] = useState("");
  const [sealing, setSealing] = useState(false);
  const [receipt, setReceipt] = useState<{ bidId: string; entryHash: string } | null>(null);

  const [chainCheck, setChainCheck] = useState<{ valid: boolean; firstBrokenIndex?: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function poll() {
      try {
        const l = await coreApi.getListing(id!);
        if (cancelled) return;
        setListing(l);
        if (l.status === "onthuld" || l.status === "onherroepelijk") {
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

  async function onBid() {
    if (!id || !listing) return;
    if (!getToken()) {
      setError("Log eerst in via de magic link.");
      return;
    }
    setSealing(true);
    setError(null);
    try {
      const { commitment, ciphertext } = await sealBid(
        { amount, conditions: [], motivation: motivation || undefined, takeover: [] },
        listing.deadline,
      );
      const res = await coreApi.placeBid(id, commitment, ciphertext);
      setReceipt(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setSealing(false);
    }
  }

  async function onVerify() {
    if (!logbook) return;
    const result = await verifyHashChainInBrowser(logbook.log);
    setChainCheck(result);
  }

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!listing) return <p>Laden…</p>;

  return (
    <div>
      <h1>{listing.address}</h1>
      <p>
        Status: <strong>{listing.status}</strong> — deadline {new Date(listing.deadline).toLocaleString("nl-NL")}
      </p>
      {listing.bidCount !== undefined && <p>Aantal biedingen: {listing.bidCount} (bedragen pas na onthulling)</p>}

      {listing.status === "biedfase" && (
        <section>
          <h2>Verzegeld bod plaatsen</h2>
          <p>Je bod wordt in deze browser versleuteld naar de deadline. Deze server kan het pas erna lezen.</p>
          <label>
            Bedrag (EUR)
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label>
            Motivatie (optioneel, alleen voor de verkoper na onthulling)
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} />
          </label>
          <button onClick={onBid} disabled={sealing}>
            {sealing ? "Verzegelen via drand…" : "Verzegeld bod indienen"}
          </button>
          {receipt && (
            <p>
              Ontvangstbewijs ontvangen: bidId <code>{receipt.bidId}</code>, logIndex bevestigd, entryHash{" "}
              <code>{receipt.entryHash.slice(0, 16)}…</code>
            </p>
          )}
        </section>
      )}

      {listing.status === "gesloten" && <p>Gesloten. Wacht op automatische onthulling via de drand-timelock…</p>}

      {logbook && (
        <section>
          <h2>Biedlogboek (onthuld)</h2>
          <table>
            <thead>
              <tr>
                <th>Bieder</th>
                <th>Bedrag</th>
                <th>Geldig</th>
              </tr>
            </thead>
            <tbody>
              {logbook.entries.map((e, i) => (
                <tr key={i}>
                  <td>{e.bidderRef}</td>
                  <td>{e.valid ? `€ ${e.amount.toLocaleString("nl-NL")}` : "—"}</td>
                  <td>{e.valid ? "ja" : `nee (${e.invalidReason})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={onVerify}>Hashketen in de browser herrekenen</button>
          {chainCheck && (
            <p>
              {chainCheck.valid
                ? "✅ De keten klopt: geen enkele regel is gewijzigd, ingevoegd of verwijderd."
                : `❌ De keten breekt bij regel ${chainCheck.firstBrokenIndex}.`}
            </p>
          )}
          <p>
            Voor volledige onafhankelijke verificatie (inclusief de handtekening) download het logboek en draai{" "}
            <code>openbod-verify logbook logboek.json</code> uit <code>packages/verifier</code>.
          </p>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(logbook, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `logboek-${listing.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download logboek.json
          </button>
        </section>
      )}
    </div>
  );
}
