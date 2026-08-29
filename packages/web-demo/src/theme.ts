import { createTheme } from "@mui/material/styles";

/**
 * Eén thema voor de hele demo. De kleur is bewust een diepe, rustige blauwtint
 * in plaats van iets opvallends: dit is een pagina waar mensen een bod van
 * enkele tonnen op afgeven, en de vormgeving hoort dat te ondersteunen in
 * plaats van om aandacht te vragen.
 *
 * Kleur draagt hier ook betekenis. Rood is gereserveerd voor fouten, groen
 * uitsluitend voor een geslaagde verificatie, en oranje voor de fase waarin
 * iets verzegeld en dus nog niet leesbaar is. Nergens wordt kleur gebruikt om
 * een bod aantrekkelijker te laten lijken dan een ander bod: de verkoper weegt
 * zelf zekerheid tegen hoogte, en de interface hoort daar geen duim op te leggen.
 */

const BLAUW = {
  main: "#164e8c",
  dark: "#0f3563",
  light: "#3e7abf",
};

/**
 * In het donkere schema draait de rol van de primaire kleur om: hij staat op
 * een donkere achtergrond en moet dus lichter zijn, anders haalt tekst erop het
 * contrastminimum niet.
 */
const BLAUW_DONKER = {
  main: "#8fb9e8",
  dark: "#6a9bd2",
  light: "#b4d2f2",
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { ...BLAUW, contrastText: "#ffffff" },
        background: { default: "#f5f8fc", paper: "#ffffff" },
        text: { primary: "#10233a", secondary: "#4a5b70" },
        divider: "#d8e2ee",
      },
    },
    dark: {
      palette: {
        primary: { ...BLAUW_DONKER, contrastText: "#0b1421" },
        background: { default: "#0c1420", paper: "#131e2c" },
        text: { primary: "#e8eef6", secondary: "#a3b4c8" },
        divider: "#26374b",
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.35rem", fontWeight: 650, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.1rem", fontWeight: 650 },
    // Kleine bijschriften dragen in deze demo veel uitleg. Iets ruimer dan de
    // MUI-standaard, want ze worden echt gelezen en zijn geen ruis.
    body2: { fontSize: "0.9rem", lineHeight: 1.6 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 650, whiteSpace: "nowrap" } } },
    MuiAlert: { defaultProps: { variant: "outlined" } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});
