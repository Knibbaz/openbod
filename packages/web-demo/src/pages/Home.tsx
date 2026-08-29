import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddHomeIcon from "@mui/icons-material/AddHomeOutlined";
import { coreApi, type Listing } from "../lib/api";
import { StatusChip } from "../components/StatusChip";

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
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Verzegeld bieden</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "58ch" }}>
          Referentie-demo van een biedproces waarin biedingen tot de deadline versleuteld zijn, ook voor deze server.
          Hoe dat werkt en hoe je het zelf narekent, staat op <Link component={RouterLink} to="/uitleg">de
          uitlegpagina</Link>.
        </Typography>
      </Stack>

      <Button
        component={RouterLink}
        to="/beheer/nieuw"
        variant="contained"
        startIcon={<AddHomeIcon />}
        sx={{ alignSelf: "flex-start" }}
      >
        Woning aanmaken
      </Button>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack spacing={1.5}>
        {listings.map((l) => (
          <Card key={l.id} variant="outlined">
            <CardActionArea component={RouterLink} to={`/woningen/${l.id}`}>
              <Stack direction={{ xs: "column", sm: "row" }}>
                <Box
                  sx={{
                    width: { xs: "100%", sm: 200 },
                    aspectRatio: { xs: "16 / 9", sm: "4 / 3" },
                    flexShrink: 0,
                    bgcolor: "action.hover",
                    backgroundImage: l.fotos[0] ? `url(${JSON.stringify(l.fotos[0])})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <Stack spacing={1} sx={{ p: 2, flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 600, mr: "auto" }}>{l.address}</Typography>
                    <StatusChip status={l.status} />
                  </Stack>
                  {l.askingPrice !== undefined && (
                    <Typography variant="h3" color="primary.main">
                      € {l.askingPrice.toLocaleString("nl-NL")}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: "auto" }}>
                    {l.kenmerken?.woonoppervlak && (
                      <Chip size="small" variant="outlined" label={`${l.kenmerken.woonoppervlak} m²`} />
                    )}
                    {l.kenmerken?.kamers && (
                      <Chip size="small" variant="outlined" label={`${l.kenmerken.kamers} kamers`} />
                    )}
                    {l.kenmerken?.energielabel && (
                      <Chip size="small" variant="outlined" label={`Label ${l.kenmerken.energielabel}`} />
                    )}
                    {l.bidCount !== undefined && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${l.bidCount} bieding${l.bidCount === 1 ? "" : "en"}`}
                      />
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
        {listings.length === 0 && !error && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">Nog geen woningen. Maak er een aan om het proces te zien.</Typography>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}
