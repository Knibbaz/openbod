import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { coreApi, getToken, type Listing, type Logbook, type OvernameStatus, type TakeoverItem } from "../lib/api";
import { sealBid, type OvernameChoice, type Voorbehoud } from "../lib/seal";
import { verifyHashChainInBrowser } from "../lib/verify";

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
  return value ? value.slice(0, 10) : "—";
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
    setSealing(true);
    setError(null);
    try {
      const { commitment, ciphertext } = await sealBid(payload, listing.deadline);
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

  function labelForItem(itemId: string): string {
    return listing?.takeoverItems.find((i) => i.itemId === itemId)?.label ?? itemId;
  }

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!listing) return <p>Laden…</p>;

  const biedbareItems = listing.takeoverItems.filter((item) => choicesFor(item.status).length > 0);

  return (
    <div>
      <h1>{listing.address}</h1>
      <p>
        Status: <strong>{listing.status}</strong> — deadline {new Date(listing.deadline).toLocaleString("nl-NL")}
      </p>
      {listing.bidCount !== undefined && <p>Aantal biedingen: {listing.bidCount} (bedragen pas na onthulling)</p>}

      {listing.takeoverItems.length > 0 && (
        <section>
          <h2>Roerende zaken</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status volgens verkoper</th>
              </tr>
            </thead>
            <tbody>
              {listing.takeoverItems.map((item) => (
                <tr key={item.itemId}>
                  <td>{item.label}</td>
                  <td>
                    {STATUS_LABELS[item.status]}
                    {item.amount !== undefined && ` (€ ${item.amount.toLocaleString("nl-NL")})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {listing.status === "biedfase" && (
        <section>
          <h2>Verzegeld bod plaatsen</h2>
          <p>
            Je hele bod — bedrag, datums, voorbehouden, overname en motivatie — wordt in deze browser versleuteld naar
            de deadline. Deze server kan het pas erna lezen.
          </p>
          <label>
            Bedrag (EUR)
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label>
            Gewenste opleverdatum (optioneel)
            <input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} />
          </label>
          <label>
            Bod geldig tot (optioneel)
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </label>

          <h3>Voorbehouden</h3>
          <p>Dat je een voorbehoud maakt is straks zichtbaar zonder waardeoordeel. De verkoper weegt zelf.</p>
          {VOORBEHOUD_LABELS.map((v) => {
            const state = conditionState(v.type);
            return (
              <div key={v.type}>
                <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={state.selected}
                    onChange={(e) => setCondition(v.type, { selected: e.target.checked })}
                  />
                  {v.label}
                </label>
                {state.selected && (
                  <>
                    <label>
                      Geregeld vóór (optioneel)
                      <input
                        type="date"
                        value={state.deadline}
                        onChange={(e) => setCondition(v.type, { deadline: e.target.value })}
                      />
                    </label>
                    <label>
                      Toelichting (optioneel)
                      <input
                        type="text"
                        maxLength={500}
                        value={state.note}
                        onChange={(e) => setCondition(v.type, { note: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
            );
          })}

          {biedbareItems.length > 0 && (
            <>
              <h3>Roerende zaken ter overname</h3>
              {biedbareItems.map((item) => {
                const state = takeoverState(item);
                return (
                  <div key={item.itemId}>
                    <label>
                      {item.label}
                      {item.amount !== undefined && ` — gevraagd € ${item.amount.toLocaleString("nl-NL")}`}
                      <select
                        value={state.choice}
                        onChange={(e) =>
                          setTakeoverChoice(item.itemId, { choice: e.target.value as OvernameChoice["choice"] })
                        }
                      >
                        {choicesFor(item.status).map((c) => (
                          <option key={c} value={c}>
                            {CHOICE_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {state.choice === "eigen_bod" && (
                      <label>
                        Jouw bod voor dit item (EUR)
                        <input
                          type="number"
                          min={0}
                          value={state.amount}
                          onChange={(e) => setTakeoverChoice(item.itemId, { amount: e.target.value })}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </>
          )}

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
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Bieder</th>
                  <th>Bedrag</th>
                  <th>Oplevering</th>
                  <th>Geldig tot</th>
                  <th>Voorbehouden</th>
                  <th>Overname</th>
                  <th>Geldig</th>
                </tr>
              </thead>
              <tbody>
                {logbook.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{e.bidderRef}</td>
                    <td>{e.valid ? `€ ${e.amount.toLocaleString("nl-NL")}` : "—"}</td>
                    <td>{e.valid ? isoToDate(e.handoverDate) : "—"}</td>
                    <td>{e.valid ? isoToDate(e.validUntil) : "—"}</td>
                    <td>
                      {!e.valid
                        ? "—"
                        : e.conditions.length === 0
                          ? "geen"
                          : e.conditions
                              .map((c) => VOORBEHOUD_LABELS.find((v) => v.type === c.type)?.label ?? c.type)
                              .join(", ")}
                    </td>
                    <td>
                      {!e.valid
                        ? "—"
                        : e.takeover.length === 0
                          ? "geen"
                          : e.takeover
                              .map(
                                (t) =>
                                  `${labelForItem(t.itemId)}: ${CHOICE_LABELS[t.choice]}` +
                                  (t.amount !== undefined ? ` (€ ${t.amount.toLocaleString("nl-NL")})` : ""),
                              )
                              .join("; ")}
                    </td>
                    <td>{e.valid ? "ja" : `nee (${e.invalidReason})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            De motivatie staat bewust niet in dit logboek: die gaat alleen naar de verkoper, niet naar de andere
            bieders.
          </p>
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
