import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { coreApi, type AdresKenmerken, type AdresSuggestie } from "../lib/api";

/**
 * Adres opzoeken in de BAG, zodat een makelaar het woonoppervlak en het
 * bouwjaar niet overtypt uit de brochure van een ander.
 *
 * De gevonden waarden vullen het formulier en zetten niets vast: de makelaar
 * kan alles corrigeren. Dat is geen slordigheid maar noodzaak, want de BAG
 * heeft het over oppervlaktes en bouwjaren geregeld anders dan de werkelijkheid
 * (een aanbouw, een splitsing, een correctie die nooit is doorgegeven). Een
 * dossier dat de woning tegenspreekt helpt een bieder niet.
 *
 * De herkomst blijft in beeld staan. Wie wil weten waar "118 m²" vandaan komt,
 * kan dat bij de bron nakijken, en dat is precies het soort controleerbaarheid
 * waar dit project om draait.
 */
export function Adreszoeker({ onGevonden }: { onGevonden: (kenmerken: AdresKenmerken) => void }) {
  const [invoer, setInvoer] = useState("");
  const [opties, setOpties] = useState<AdresSuggestie[]>([]);
  const [zoekt, setZoekt] = useState(false);
  const [haalt, setHaalt] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gevonden, setGevonden] = useState<AdresKenmerken | null>(null);

  // Wachten tot iemand even ophoudt met typen: elke toetsaanslag doorsturen zou
  // een gratis publieke voorziening onnodig belasten.
  useEffect(() => {
    if (invoer.trim().length < 3) {
      setOpties([]);
      return;
    }
    let geannuleerd = false;
    setZoekt(true);
    const t = setTimeout(() => {
      coreApi
        .zoekAdressen(invoer)
        .then((r) => {
          if (!geannuleerd) {
            setOpties(r);
            setFout(null);
          }
        })
        .catch(() => {
          if (!geannuleerd) setFout("Het zoeken lukte niet. Vul de gegevens gerust zelf in.");
        })
        .finally(() => {
          if (!geannuleerd) setZoekt(false);
        });
    }, 350);
    return () => {
      geannuleerd = true;
      clearTimeout(t);
    };
  }, [invoer]);

  async function kies(optie: AdresSuggestie | null) {
    if (!optie) return;
    setHaalt(true);
    setFout(null);
    try {
      const kenmerken = await coreApi.getAdresKenmerken(optie.id);
      setGevonden(kenmerken);
      onGevonden(kenmerken);
    } catch {
      setFout("De gegevens van dit adres zijn nu niet op te halen. Vul ze gerust zelf in.");
    } finally {
      setHaalt(false);
    }
  }

  const geenWoning = gevonden?.gebruiksdoel !== undefined && !gevonden.gebruiksdoel.includes("woonfunctie");

  return (
    <Stack spacing={1.5}>
      <Autocomplete
        options={opties}
        getOptionLabel={(o) => o.weergavenaam}
        filterOptions={(x) => x}
        loading={zoekt || haalt}
        onInputChange={(_e, waarde) => setInvoer(waarde)}
        onChange={(_e, waarde) => void kies(waarde)}
        noOptionsText={invoer.trim().length < 3 ? "Typ een straat en plaats" : "Geen adres gevonden"}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Zoek het adres"
            placeholder="Kastanjelaan 12 Zwolle"
            helperText="Vult adres, woonoppervlak en bouwjaar in uit de BAG van het Kadaster. Alles blijft daarna aanpasbaar."
            slotProps={{
              input: {
                ...params.slotProps?.input,
                endAdornment: (
                  <>
                    {(zoekt || haalt) && <CircularProgress size={18} sx={{ mr: 1 }} />}
                    {params.slotProps?.input?.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />

      {fout && <Alert severity="warning">{fout}</Alert>}

      {gevonden && (
        <Alert severity={geenWoning ? "warning" : "success"}>
          <Typography variant="body2">
            Overgenomen uit {gevonden.bron}: {gevonden.adres}
            {gevonden.woonoppervlak !== undefined && <>, {gevonden.woonoppervlak} m²</>}
            {gevonden.bouwjaar !== undefined && <>, bouwjaar {gevonden.bouwjaar}</>}. Klopt er iets niet, pas het dan
            aan; wat jij hier neerzet gaat het dossier in, niet wat de BAG zegt.
          </Typography>
          {geenWoning && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Let op: de BAG noemt dit gebruiksdoel <strong>{gevonden.gebruiksdoel}</strong> en geen woonfunctie.
              Controleer of je het juiste adres te pakken hebt.
            </Typography>
          )}
        </Alert>
      )}
    </Stack>
  );
}
