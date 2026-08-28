import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { coreApi, type Listing } from "../lib/api";

export function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coreApi.listListings().then(setListings).catch((e) => setError(String(e)));
    const interval = setInterval(() => {
      coreApi.listListings().then(setListings).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>OpenBod — verzegeld bieden</h1>
      <p>
        Referentie-demo van een verzegeld biedproces. Biedingen zijn tot de deadline versleuteld, ook voor deze
        server — geverifieerd op <Link to="/uitleg">de uitlegpagina</Link>.
      </p>
      <Link to="/woningen/nieuw">
        <button>Woning aanmaken</button>
      </Link>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            <Link to={`/woningen/${l.id}`}>
              {l.address} — {l.status}
              {l.bidCount !== undefined ? ` (${l.bidCount} bieding${l.bidCount === 1 ? "" : "en"})` : ""}
            </Link>
          </li>
        ))}
        {listings.length === 0 && <li>Nog geen woningen. Maak er een aan.</li>}
      </ul>
    </div>
  );
}
