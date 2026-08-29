import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { identityApi, setToken } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("koper@example.com");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    try {
      const res = await identityApi.requestMagicLink(email);
      setSent(true);
      // devLink/devToken zijn alleen aanwezig in dev-modus; in productie
      // geeft identity ze bewust niet terug (zie packages/identity).
      setDevLink(res.devLink ?? null);
      setDevToken(res.devToken ?? null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function consume() {
    if (!devToken) return;
    try {
      const { accessToken } = await identityApi.consume(devToken);
      setToken(accessToken);
      navigate("/");
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div>
      <h1>Inloggen via magic link</h1>
      <p>
        Demo-vereenvoudiging: er is geen mailserver aangesloten, dus de link wordt in dev-modus hieronder getoond in
        plaats van gemaild (protocol.md §7: magic link nu, iDIN later, zonder de core te wijzigen). In productie
        toont de API deze link nooit rechtstreeks.
      </p>
      <form onSubmit={requestLink}>
        <label>
          E-mailadres
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit">Stuur magic link</button>
      </form>
      {sent && !devLink && <p>Als dit e-mailadres bekend is, is er een magic link verstuurd. Check je inbox.</p>}
      {devLink && (
        <div>
          <p>Magic link (normaal per e-mail):</p>
          <code>{devLink}</code>
          <button onClick={consume}>Link openen en inloggen</button>
        </div>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
