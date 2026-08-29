import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddHomeIcon from "@mui/icons-material/AddHomeOutlined";
import { coreApi, type Listing } from "../lib/api";
import { listSellerKeyListingIds } from "../lib/identity-envelope";
import { StatusChip } from "../components/StatusChip";

/**
 * Het overzicht van de makelaar of verkoper: alleen de woningen waarvan deze
 * browser de sleutel heeft.
 *
 * Dat "van deze browser" is geen luiheid maar een gevolg van het ontwerp. De
 * server weet niet wie de verkoper is en hoort dat ook niet te weten, dus er is
 * geen serverbegrip van eigenaarschap om op terug te vallen. De keerzijde staat
 * er met zoveel woorden bij, want een makelaar die op een ander apparaat inlogt
 * en zijn woningen niet ziet, verdient een uitleg en geen leeg scherm.
 */
export function BeheerOverzicht() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eigen = listSellerKeyListingIds();
    async function laad() {
      try {
        setListings(await coreApi.listMine(eigen));
      } catch (e) {
        setError(String(e));
      }
    }
    laad();
    const t = setInterval(laad, 4000);
    return () => clearInterval(t);
  }, []);

  const wachtOpActie = (l: Listing) => l.status === "onthuld" && !l.awardedBidId;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-end" } }}>
        <Stack spacing={1} sx={{ mr: "auto" }}>
          <Typography variant="h1">Beheer</Typography>
          <Typography color="text.secondary">
            Je woningen, hun fase, en wat er van jou wordt verwacht.
          </Typography>
        </Stack>
        <Button component={RouterLink} to="/beheer/nieuw" variant="contained" startIcon={<AddHomeIcon />}>
          Woning klaarzetten
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {listings?.some(wachtOpActie) && (
        <Alert severity="info">
          Er {listings.filter(wachtOpActie).length === 1 ? "wacht een woning" : "wachten woningen"} op je keuze: de
          biedingen zijn open en er is nog niet gegund.
        </Alert>
      )}

      <Stack spacing={1.5}>
        {listings?.map((l) => (
          <Card key={l.id} variant="outlined">
            <CardActionArea component={RouterLink} to={`/beheer/${l.id}`} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 600, mr: "auto" }}>{l.address}</Typography>
                {wachtOpActie(l) && <Chip size="small" color="warning" label="Wacht op je keuze" />}
                {l.bidCount !== undefined && (
                  <Chip size="small" variant="outlined" label={`${l.bidCount} bieding${l.bidCount === 1 ? "" : "en"}`} />
                )}
                <StatusChip status={l.status} />
              </Stack>
            </CardActionArea>
          </Card>
        ))}

        {listings?.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Stack spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontWeight: 600 }}>Nog geen woningen op dit apparaat</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "52ch" }}>
                Je ziet hier de woningen waarvan dit apparaat de sleutel bewaart. Die sleutel wordt bewust nergens
                anders opgeslagen: daarom kan deze website nooit zien wie er op jouw woningen biedt. De keerzijde is
                dat je op een ander apparaat of na het wissen van je browsergegevens opnieuw begint.
              </Typography>
              <Button component={RouterLink} to="/beheer/nieuw" variant="contained" startIcon={<AddHomeIcon />}>
                Eerste woning klaarzetten
              </Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}
