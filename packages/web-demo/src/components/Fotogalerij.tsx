import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/HomeOutlined";

/**
 * De foto's van de woning. De instantie host geen bestanden: dit zijn
 * verwijzingen naar elders, en ze kunnen dus ontbreken of stukgaan. Een kapotte
 * afbeelding mag de pagina niet ontsieren, dus die verdwijnt gewoon uit de reeks.
 */
export function Fotogalerij({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [kapot, setKapot] = useState<Set<string>>(new Set());
  const [actief, setActief] = useState(0);
  const bruikbaar = fotos.filter((f) => !kapot.has(f));

  if (bruikbaar.length === 0) {
    return (
      <Stack
        sx={{
          alignItems: "center",
          justifyContent: "center",
          aspectRatio: "16 / 9",
          bgcolor: "action.hover",
          borderRadius: 2,
          color: "text.secondary",
          gap: 1,
        }}
      >
        <HomeIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography variant="body2">Geen foto's beschikbaar</Typography>
      </Stack>
    );
  }

  const hoofd = bruikbaar[Math.min(actief, bruikbaar.length - 1)];

  return (
    <Stack spacing={1}>
      <Box
        component="img"
        src={hoofd}
        alt={alt}
        onError={() => setKapot((prev) => new Set(prev).add(hoofd))}
        sx={{
          width: "100%",
          aspectRatio: "16 / 9",
          objectFit: "cover",
          borderRadius: 2,
          bgcolor: "action.hover",
          display: "block",
        }}
      />
      {bruikbaar.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
          {bruikbaar.map((foto, i) => (
            <Box
              key={foto}
              component="img"
              src={foto}
              alt=""
              onClick={() => setActief(i)}
              onError={() => setKapot((prev) => new Set(prev).add(foto))}
              sx={{
                width: 92,
                height: 62,
                flexShrink: 0,
                objectFit: "cover",
                borderRadius: 1,
                cursor: "pointer",
                bgcolor: "action.hover",
                outline: foto === hoofd ? "2px solid" : "1px solid",
                outlineColor: foto === hoofd ? "primary.main" : "divider",
              }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
