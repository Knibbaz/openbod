import { Link as RouterLink, Route, Routes, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/LockOutlined";
import { Home } from "./pages/Home";
import { CreateListing } from "./pages/CreateListing";
import { Login } from "./pages/Login";
import { ListingDetail } from "./pages/ListingDetail";
import { Uitleg } from "./pages/Uitleg";
import { clearToken, getToken } from "./lib/api";

function App() {
  const ingelogd = getToken() !== null;
  const locatie = useLocation();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ bgcolor: "background.paper" }}>
        <Container maxWidth="md" disableGutters>
          <Toolbar sx={{ gap: 1, px: { xs: 2, sm: 0 } }}>
            <Stack
              component={RouterLink}
              to="/"
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", textDecoration: "none", color: "primary.main", mr: "auto" }}
            >
              <LockIcon fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
                OpenBod
              </Typography>
            </Stack>
            <Button
              component={RouterLink}
              to="/uitleg"
              color={locatie.pathname === "/uitleg" ? "primary" : "inherit"}
              size="small"
            >
              Uitleg
            </Button>
            {ingelogd ? (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  clearToken();
                  window.location.reload();
                }}
              >
                Uitloggen
              </Button>
            ) : (
              <Button component={RouterLink} to="/login" size="small" variant="contained">
                Inloggen
              </Button>
            )}
          </Toolbar>
        </Container>
        <Divider />
      </AppBar>

      <Container maxWidth="md" component="main" sx={{ flex: 1, py: { xs: 3, sm: 5 } }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/woningen/nieuw" element={<CreateListing />} />
          <Route path="/woningen/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/uitleg" element={<Uitleg />} />
        </Routes>
      </Container>

      <Divider />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Referentie-implementatie, open source onder de EUPL 1.2. Deze instantie bevat verzonnen woningen en is geen
          productiesysteem.
        </Typography>
      </Container>
    </Box>
  );
}

export default App;
