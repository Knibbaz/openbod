import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/**
 * Eén blok op een pagina. De demo bestaat vooral uit uitleg naast handelingen,
 * dus elke sectie heeft een kop en optioneel een toelichting erboven. Die
 * toelichting staat expres vóór de bedieningselementen: wie hier iets indient,
 * hoort eerst te weten wat er met zijn gegevens gebeurt.
 */
export function Sectie({
  titel,
  toelichting,
  actie,
  children,
}: {
  titel: string;
  toelichting?: ReactNode;
  actie?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="h2" sx={{ mr: "auto" }}>
            {titel}
          </Typography>
          {actie}
        </Stack>
        {toelichting && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch" }}>
            {toelichting}
          </Typography>
        )}
        {children}
      </Stack>
    </Paper>
  );
}
