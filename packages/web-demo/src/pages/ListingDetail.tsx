import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
      setMyBid({ ...res, version: (myBid?.version ?? 0) + 1, createdAt: myBid?.createdAt ?? res.timestamp, updatedAt: res.timestamp });
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

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!listing) return <p>Laden…</p>;

  const biedbareItems = listing.takeoverItems.filter((item) => choicesFor(item.status).length > 0);
  // Je bent hier de verkoper als je de private sleutel van deze woning hebt.
  const isSeller = loadSellerKey(listing.id) !== null;

  return (
    <div>
      <h1>{listing.address}</h1>
      <p>
        Status: <strong>{listing.status}</strong>, deadline {new Date(listing.deadline).toLocaleString("nl-NL")}
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

      {listing.status === "biedfase" && myBid && (
        <section>
          <h2>Jouw lopende bod</h2>
          <p>
            Dit is je bewijs dat je bod in het logboek staat. Bewaar het: na de onthulling kun je hiermee narekenen dat
            precies dit bod is meegeteld. Het bedrag staat er bewust niet bij, want de server kan dat zelf nog niet lezen.
          </p>
          <table>
            <tbody>
              <tr>
                <th>Ingediend op</th>
                <td>{new Date(myBid.createdAt).toLocaleString("nl-NL")}</td>
              </tr>
              <tr>
                <th>Laatst gewijzigd</th>
                <td>
                  {new Date(myBid.updatedAt).toLocaleString("nl-NL")} (versie {myBid.version})
                </td>
              </tr>
              <tr>
                <th>bidId</th>
                <td>
                  <code>{myBid.bidId}</code>
                </td>
              </tr>
              <tr>
                <th>Logregel</th>
                <td>#{myBid.logIndex}</td>
              </tr>
              <tr>
                <th>entryHash</th>
                <td>
                  <code>{myBid.entryHash}</code>
                </td>
              </tr>
            </tbody>
          </table>
          {listing.rules.intrekkenToegestaan ? (
            <button onClick={onWithdraw}>Bod intrekken</button>
          ) : (
            <p>Intrekken is voor deze woning niet toegestaan. Dat stond vooraf vast, voor iedereen gelijk.</p>
          )}
        </section>
      )}

      {listing.status === "biedfase" && (
        <section>
          <h2>{myBid ? "Je bod aanpassen" : "Verzegeld bod plaatsen"}</h2>
          {myBid && !listing.rules.aanpassenToegestaan && (
            <p>Aanpassen is voor deze woning niet toegestaan. Dat stond vooraf vast, voor iedereen gelijk.</p>
          )}
          {myBid && listing.rules.aanpassenToegestaan && (
            <p>
              Je vervangt hiermee je hele bod door een nieuwe verzegeling. Dat je hebt aangepast blijft in het logboek
              staan, wat je aanpaste niet. Dat is tot de deadline voor niemand leesbaar.
            </p>
          )}
          <p>
            Je hele bod (bedrag, datums, voorbehouden, overname en motivatie) wordt in deze browser versleuteld naar
            de deadline. Deze server kan het pas erna lezen.
          </p>
          {listing.sellerPublicKey && (
            <>
              <h3>Wie je bent</h3>
              <p>
                Je naam wordt apart versleuteld naar de verkoper. Deze server kan hem niet lezen, de makelaar ook niet,
                en de verkoper pas op het moment dat hij aan jou gunt. In het openbare logboek verschijnt hij nooit.
              </p>
              <label>
                Naam
                <input value={bidderName} onChange={(e) => setBidderName(e.target.value)} />
              </label>
              <label>
                Contact (optioneel, bijvoorbeeld e-mail of telefoon)
                <input value={bidderContact} onChange={(e) => setBidderContact(e.target.value)} />
              </label>
            </>
          )}
          <h3>Je bod</h3>
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
                      {item.amount !== undefined && ` (gevraagd € ${item.amount.toLocaleString("nl-NL")})`}
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
          <button onClick={onBid} disabled={sealing || (myBid !== null && !listing.rules.aanpassenToegestaan)}>
            {sealing ? "Verzegelen via drand…" : myBid ? "Aangepast bod verzegelen" : "Verzegeld bod indienen"}
          </button>
        </section>
      )}

      {listing.status === "gesloten" && <p>Gesloten. Wacht op automatische onthulling via de drand-timelock…</p>}

      {listing.status === "buiten_procedure" && (
        <section>
          <h2>Buiten deze procedure afgehandeld</h2>
          <p>
            Deze verkoop is niet via de deadline en de gunning afgerond. Opgegeven reden:{" "}
            <strong>{listing.buitenProcedureReden}</strong>
            {listing.buitenProcedureAt && ` (${new Date(listing.buitenProcedureAt).toLocaleString("nl-NL")})`}
          </p>
          <p>
            Verzegelde biedingen die op dat moment nog niet geopend waren, blijven verzegeld: ze worden niet alsnog
            opengemaakt voor een procedure die niet doorgaat. Wat je wél houdt, is het bewijs dát je bod er stond en
            dat het nooit geopend is, zichtbaar in de keten hieronder.
          </p>
        </section>
      )}

      {isSeller && listing.status !== "buiten_procedure" && listing.status !== "onherroepelijk" && (
        <section>
          <h2>Buiten deze procedure afhandelen</h2>
          <p>
            Wordt de woning onderhands verkocht, van de markt gehaald of anderszins buiten dit biedproces om
            afgehandeld? Sluit de procedure dan hier af met een reden. Een inschrijving die zonder uitleg stilvalt is
            precies waarover kopers klagen; dit maakt er een vastgelegde eindstatus van, en alle bieders krijgen
            automatisch het logboek.
          </p>
          <label>
            Reden (komt onverkort in het openbare logboek)
            <input
              value={abortReason}
              onChange={(e) => setAbortReason(e.target.value)}
              maxLength={500}
              placeholder="Bijvoorbeeld: woning onderhands verkocht buiten de inschrijving om"
            />
          </label>
          <button onClick={onAbort} disabled={aborting}>
            {aborting ? "Vastleggen…" : "Procedure afsluiten en logboek versturen"}
          </button>
        </section>
      )}

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
                  {isSeller && <th>Gunning</th>}
                </tr>
              </thead>
              <tbody>
                {logbook.entries.map((e, i) => (
                  <tr key={i}>
                    <td>{e.bidderRef}</td>
                    <td>{e.valid ? `€ ${e.amount.toLocaleString("nl-NL")}` : "-"}</td>
                    <td>{e.valid ? isoToDate(e.handoverDate) : "-"}</td>
                    <td>{e.valid ? isoToDate(e.validUntil) : "-"}</td>
                    <td>
                      {!e.valid
                        ? "-"
                        : e.conditions.length === 0
                          ? "geen"
                          : e.conditions
                              .map((c) => VOORBEHOUD_LABELS.find((v) => v.type === c.type)?.label ?? c.type)
                              .join(", ")}
                    </td>
                    <td>
                      {!e.valid
                        ? "-"
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
                    {isSeller && (
                      <td>
                        {listing.awardedBidId === e.bidId ? (
                          <strong>gegund</strong>
                        ) : listing.awardedBidId || !e.valid ? (
                          "-"
                        ) : (
                          <button onClick={() => onAward(e.bidId)} disabled={awarding}>
                            Gun aan deze bieder
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            De motivatie staat bewust niet in dit logboek: die gaat alleen naar de verkoper, niet naar de andere
            bieders. Namen staan er ook niet in, en zijn tot de gunning voor niemand leesbaar.
          </p>
          {awardedIdentity && (
            <p>
              Identiteit vrijgegeven na gunning: <strong>{awardedIdentity.name}</strong>
              {awardedIdentity.contact && ` (${awardedIdentity.contact})`}. Dat deze vrijgave plaatsvond, staat nu als
              aparte regel in het logboek hierboven.
            </p>
          )}
          {isSeller && listing.awardedBidId && !awardedIdentity && (
            <p>
              Er is gegund, maar de identiteit kon niet geopend worden. Dat gebeurt als deze browser de sleutel van
              deze woning niet meer heeft, of als de bieder geen naam meestuurde.
            </p>
          )}
          <h3>Is het logboek verstuurd?</h3>
          {delivery ? (
            <p>
              Ja, op {new Date(delivery.deliveredAt).toLocaleString("nl-NL")} naar{" "}
              {delivery.recipientRefs.length} betrokkene(n): {delivery.recipientRefs.join(", ")}. Dat staat als regel{" "}
              {delivery.logIndex} (<code>logboek_verstuurd</code>) in de keten, dus of jij het hoort te krijgen is
              geen kwestie van welles-nietes meer. Er staan alleen pseudonieme verwijzingen in, geen adressen.
            </p>
          ) : (
            <p>
              Nog niet. Zodra de procedure een eindstatus bereikt, gaat het logboek vanzelf naar alle betrokkenen.
              Je hoeft er niet om te vragen.
            </p>
          )}

          <h3>Zelf controleren</h3>
          <p>
            Elke regel hierboven bevat de hash van de regel ervóór. Wie achteraf iets wijzigt, invoegt of weghaalt,
            breekt die keten op een zichtbare plek. Met de knop hieronder rekent <em>jouw browser</em> de hele keten
            opnieuw uit. Je hoeft deze server dus niet te geloven: je controleert zijn huiswerk.
          </p>
          <button onClick={onVerify}>Controleer zelf of er niets gewijzigd is</button>
          {chainCheck && (
            <p>
              {chainCheck.valid
                ? "✅ De keten klopt: geen enkele regel is gewijzigd, ingevoegd of verwijderd."
                : `❌ De keten breekt bij regel ${chainCheck.firstBrokenIndex}.`}
            </p>
          )}
          <p>
            Wat deze controle <strong>niet</strong> zegt: of dit logboek echt van deze instantie komt. Daarvoor is de
            handtekening onderaan het logboek nodig, en die kun je alleen buiten de browser natrekken. Download het
            logboek en draai <code>openbod-verify logbook logboek.json</code> uit <code>packages/verifier</code>; dat
            controleert de keten, de root-hash én de handtekening.
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
