import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Inloggen</Typography>
        <Typography color="text.secondary">
          Je adres gaat niet naar het biedsysteem. De inlogdienst maakt er een pseudoniem van; de biedlogica ziet
          alleen dat pseudoniem en kan er niet uit afleiden wie je bent.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack component="form" onSubmit={requestLink} spacing={2}>
          <TextField
            label="E-mailadres"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Stuur magic link
          </Button>
        </Stack>
      </Paper>

      {sent && !devLink && (
        <Alert severity="info">Als dit e-mailadres bekend is, is er een magic link verstuurd. Check je inbox.</Alert>
      )}

      {devLink && (
        <Alert severity="warning">
          <AlertTitle>Demo-instantie: de link staat hier in plaats van in je inbox</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Er is geen mailserver aangesloten. In productie toont de API deze link nooit rechtstreeks, want dan zou
            iedereen kunnen inloggen als elk adres.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <code>{devLink}</code>
          </Typography>
          <Button variant="contained" color="warning" onClick={consume}>
            Link openen en inloggen
          </Button>
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Typography variant="body2" color="text.secondary">
        Later schuift hier een zwaarder identiteitsmiddel in (iDIN-waardig), zonder dat de biedlogica verandert. Zie
        <code> spec/protocol.md</code> §7.
      </Typography>
    </Stack>
  );
}
