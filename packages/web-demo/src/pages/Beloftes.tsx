import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import OpenIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { Sectie } from "../components/Sectie";

/**
 * Wat deze instantie belooft, waarom u het niet op haar woord hoeft te geloven,
 * en wat zij er nadrukkelijk niet bij belooft.
 *
 * Eén redactieregel houdt deze pagina eerlijk: **een belofte staat hier alleen
 * als er een invariant uit `spec/protocol.md` achter zit.** Wat geen invariant
 * heeft, is een voornemen en hoort in de derde kolom. Zo kan deze pagina niet
 * uit de pas gaan lopen met wat het systeem werkelijk afdwingt, en dat is
 * precies het verschil dat dit project wil laten zien.
 *
 * De derde kolom is geen kleine lettertjes maar de kern. Een standaard die meer
 * belooft dan zij afdwingt, is het probleem dat we proberen op te lossen.
 */

type Stand = "afgedwongen" | "grens" | "nog-niet";

interface Belofte {
  invariant: string;
  belofte: string;
  /** Het mechanisme, plus hoe u het zelf narekent. */
  waarom: string;
  /** Wat hier nadrukkelijk niet bij beloofd wordt. */
  nietBeloofd: string;
  stand: Stand;
}

const GROEPEN: { titel: string; inleiding: string; beloftes: Belofte[] }[] = [
  {
    titel: "Uw bod blijft geheim tot de sluitingstijd",
    inleiding:
      "Dit is de kern. Niet omdat wij beloven niet te kijken, maar omdat de sleutel om te kijken op dat moment nog niet bestaat.",
    beloftes: [
      {
        invariant: "I1",
        belofte: "Niemand kan uw bod lezen voordat de inschrijving sluit. Ook wij niet, ook de makelaar niet.",
        waarom:
          "Uw bod wordt in uw eigen browser versleuteld. Wat wij opslaan is een onleesbaar pakket plus een vingerafdruk. De ontsleutelsleutel wordt gemaakt door drand, een netwerk van onafhankelijke organisaties, en pas op de sluitingstijd. U kunt in het verzegelde bestand zelf zien naar welke ronde en welk netwerk er versleuteld is.",
        nietBeloofd:
          "Dat wij niet zien dát u meedoet. Wij weten wel dat er een bod van u ligt, alleen niet wat erin staat. Ook een bewaard concept, dat u nog niet verstuurd hebt, is voor ons wel leesbaar.",
        stand: "afgedwongen",
      },
      {
        invariant: "I4",
        belofte: "De biedingen gaan voor iedereen op hetzelfde moment open.",
        waarom:
          "Er is geen knop om eerder te openen. De sleutel bestaat niet vóór de sluitingstijd en is erna voor iedereen beschikbaar, dus ook voor u.",
        nietBeloofd:
          "Dat het exact op de seconde gebeurt. Het openen kost enkele seconden, want er moet op de openbare sleutel gewacht worden.",
        stand: "afgedwongen",
      },
      {
        invariant: "I12",
        belofte:
          "Wie u bent, is voor ons en voor de makelaar op geen enkel moment leesbaar. De verkoper leest het pas nadat hij aan u gunt.",
        waarom:
          "Uw naam reist apart, versleuteld naar de persoonlijke sleutel van de verkoper. Die sleutel hebben wij niet en kunnen wij niet krijgen. Dat de verkoper hem krijgt, wordt een regel in het logboek.",
        nietBeloofd:
          "Dat de verkoper pas op het moment van gunnen kíjkt. Hij houdt zijn sleutel de hele tijd. Dat is een afspraak en een gelogde gebeurtenis, geen wiskundige grendel. Dát wij en de makelaar het nooit kunnen lezen, is dat wel.",
        stand: "grens",
      },
    ],
  },
  {
    titel: "Uw bod kan niet verdwijnen of stilletjes veranderen",
    inleiding:
      "De tweede klacht na het meekijken: een bod dat er ineens niet meer was, of een bedrag dat anders bleek. Daar staan vier mechanismen tegenover.",
    beloftes: [
      {
        invariant: "I2",
        belofte: "Bij het openen komt uw bod eruit zoals u het verzegelde, of het wordt als ongeldig vastgelegd.",
        waarom:
          "Bij het openen wordt het bod nagerekend tegen de vingerafdruk die er al lag. Een ander bod erin schuiven kan niet: dat levert een andere vingerafdruk op en dat is zichtbaar in het logboek.",
        nietBeloofd:
          "Dat een bod dat u zelf verkeerd invulde alsnog wordt gerepareerd. Wat verzegeld is, ligt vast.",
        stand: "afgedwongen",
      },
      {
        invariant: "I3",
        belofte: "Elke wijziging in het logboek is aantoonbaar. Regels toevoegen, veranderen of weghalen kan niet ongemerkt.",
        waarom:
          "Elke regel draagt de vingerafdruk van de regel ervóór. Wie er één aanraakt, breekt de ketting op een aanwijsbare plek. In de demo rekent uw eigen browser de hele ketting na, en de losse verifier doet het buiten deze website om.",
        nietBeloofd:
          "Dat wij de ketting niet in zijn geheel opnieuw zouden kúnnen opbouwen. Wij hebben de ondertekensleutel. Wat dat onmogelijk maakt is verankering in een openbaar register, en die staat nog niet aan. Zie onderaan.",
        stand: "grens",
      },
      {
        invariant: "I5, I6",
        belofte: "Elke handeling levert precies één regel op, en een aangepast bod laat de oude versie staan.",
        waarom:
          "Plaatsen, aanpassen en intrekken worden alle drie gelogd. Aanpassen is geen wijziging maar een nieuwe versie; de vorige blijft in de historie staan.",
        nietBeloofd: "Dat het logboek laat zien wát u aanpaste. Alleen dát u aanpaste, en wanneer.",
        stand: "afgedwongen",
      },
      {
        invariant: "I7",
        belofte: "U krijgt bij elk bod een ondertekend ontvangstbewijs waarmee u zelf kunt aantonen dat het meetelde.",
        waarom:
          "Op het bewijs staat de plek van uw bod in de ketting en de handtekening van deze instantie. Met de losse verifier controleert u dat buiten ons om. Bewaar het: wij zijn de enige plek waar het staat en u bent de enige die het nodig heeft.",
        nietBeloofd:
          "Dat wij het bewijs voor u bewaren of opnieuw kunnen uitgeven nadat de gegevens weg zijn. Op deze demo-instantie wordt alles bovendien elk half uur gewist.",
        stand: "afgedwongen",
      },
    ],
  },
  {
    titel: "De regels en de woning liggen vooraf vast",
    inleiding: "Een bod is een reactie op wat er stond. Dus moet vastliggen wat er stond, en volgens welke regels.",
    beloftes: [
      {
        invariant: "I9",
        belofte:
          "De spelregels staan vast op het moment dat de inschrijving opengaat en kunnen halverwege niet veranderen.",
        waarom:
          "Of intrekken mag, of aanpassen mag, en of het aantal biedingen zichtbaar is: het wordt bij het openen vastgelegd en staat op het scherm. Voor iedere bieder gelijk.",
        nietBeloofd:
          "Dat de regels in uw voordeel zijn. Een verkoper mag aanpassen verbieden; u weet dat dan vooraf en kunt daarop besluiten mee te doen of niet.",
        stand: "afgedwongen",
      },
      {
        invariant: "I15",
        belofte: "Waarop u bood, ligt net zo vast als dát u bood.",
        waarom:
          "Alles wat aan bieders getoond is (kenmerken, omschrijving, foto's, prijsvorm, roerende zaken, spelregels) zit als één code in de openingsregel van het logboek. Wordt het woonoppervlak later bijgesteld, dan verandert die code mee en is dat na te rekenen.",
        nietBeloofd:
          "Dat de getoonde gegevens juist zijn. Wij leggen vast wat er stond, niet dat het klopte. Voor de feitelijke juistheid blijft de verkoper aansprakelijk.",
        stand: "afgedwongen",
      },
    ],
  },
  {
    titel: "U krijgt bewijs, ook als het misgaat",
    inleiding:
      "Sinds 2023 is het biedlogboek verplicht, maar in de praktijk kreeg ongeveer een derde van de kopers het, en dan meestal pas na erom te vragen. Daarom is verstrekken hier geen knop maar een gevolg.",
    beloftes: [
      {
        invariant: "I13",
        belofte:
          "Een inschrijving kan niet stilvallen zonder uitleg. Wordt de woning buiten deze procedure om verkocht, dan is dat een vastgelegde eindstatus met een opgegeven reden.",
        waarom:
          "Het systeem kan zo'n verkoop niet verhinderen, want die gebeurt buiten het systeem. Het kan wel afdwingen dat er iets controleerbaars van overblijft, met de reden onverkort in het openbare logboek.",
        nietBeloofd:
          "Dat de opgegeven reden waar is. Wij leggen vast wat er opgegeven werd en wanneer, zodat het aanvechtbaar wordt in plaats van onzichtbaar.",
        stand: "afgedwongen",
      },
      {
        invariant: "I14",
        belofte:
          "Het biedlogboek gaat vanzelf naar alle betrokkenen zodra de procedure klaar is. U hoeft er niet om te vragen.",
        waarom:
          "De verzending is zelf een regel in de ketting, met alleen pseudonieme ontvangers erin. Daarmee wordt “ik heb nooit een logboek gekregen” een controleerbare bewering in plaats van welles-nietes.",
        nietBeloofd:
          "Dat er op deze demo-instantie echt een e-mail verstuurd wordt. Er is geen mailserver aangesloten; de verzending wordt wel volledig gelogd.",
        stand: "grens",
      },
    ],
  },
  {
    titel: "Uw gegevens blijven van u",
    inleiding: "Wat in het openbare logboek terechtkomt, is met opzet zo weinig mogelijk.",
    beloftes: [
      {
        invariant: "I11",
        belofte:
          "Uw naam en uw motivatie komen niet in het openbare logboek, en uw pseudoniem is niet terug te rekenen naar u.",
        waarom:
          "In het logboek staan bedragen, voorbehouden en pseudonieme verwijzingen. Het pseudoniem is geen kale hash van uw e-mailadres maar een berekening met een geheim dat alleen de identiteitsdienst kent, dus ook niet te raden met een lijst waarschijnlijke adressen.",
        nietBeloofd:
          "Dat uw bedrag geheim blijft ná de sluitingstijd. Alle geldige biedingen worden dan openbaar, met pseudoniem. Dat is het punt van een controleerbaar logboek.",
        stand: "afgedwongen",
      },
      {
        invariant: "I10",
        belofte: "De garanties blijven gelden als de manier van inloggen verandert.",
        waarom:
          "De biedkant kent alleen een pseudoniem onderwerp uit een ondertekend token. Of dat van een magic link komt of straks van DigiD of iDIN, verandert niets aan de ketting, de verzegeling of het logboek.",
        nietBeloofd:
          "Dat een magic link net zo sterk is als DigiD. Het niveau van de identiteitscontrole staat in het token, en op deze demo-instantie is het bewust laag.",
        stand: "afgedwongen",
      },
    ],
  },
];

const OPENSTAAND = [
  {
    kop: "Verankering in een openbaar register (I8)",
    tekst:
      "Dit is het belangrijkste dat nog ontbreekt. De ketting is intern sluitend, maar niets buiten deze instantie legt vast hoe zij er gisteren uitzag. Wie de ondertekensleutel heeft, zou de hele ketting opnieuw kunnen opbouwen. Pas wanneer elke instantie haar slotcodes publiceert in een gedeeld, openbaar register, wordt herschrijven achteraf zichtbaar voor iedereen. Tot die tijd is uw bewaarde ontvangstbewijs de sterkste controle die u heeft.",
  },
  {
    kop: "De code die uw bod verzegelt, komt van ons",
    tekst:
      "Het verzegelen gebeurt in uw browser, maar de pagina die dat doet wordt door deze instantie geleverd. Wie hier kwaad wil, zou code kunnen uitleveren die het bedrag ook onversleuteld meestuurt, en geen enkel ontvangstbewijs zou dat laten zien. Daarom komt het biedformulier op termijn uit een apart, gecertificeerd onderdeel dat niet meebeweegt met de huisstijl van de makelaar, en komt er gereedschap om zonder deze website te bieden.",
  },
  {
    kop: "Niemand controleert ons",
    tekst:
      "Er is nog geen toetsende partij die instanties certificeert en een certificaat kan intrekken. Zolang dat er niet is, kunt u wel narekenen dát deze instantie zich aan haar eigen logboek houdt, maar niet opzoeken of zij door iemand is goedgekeurd.",
  },
  {
    kop: "Dit verlaagt geen prijzen",
    tekst:
      "Dit systeem lost inzicht en eerlijkheid op, niet de schaarste die overbieden veroorzaakt. Wie hier iets anders van verwacht, komt bedrogen uit.",
  },
];

function StandChip({ stand }: { stand: Stand }) {
  if (stand === "afgedwongen") {
    return <Chip size="small" color="success" variant="outlined" icon={<CheckIcon />} label="Afgedwongen" />;
  }
  return <Chip size="small" color="warning" variant="outlined" icon={<OpenIcon />} label="Met een grens" />;
}

function BelofteBlok({ belofte }: { belofte: Belofte }) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 600, mr: "auto", maxWidth: "60ch" }}>{belofte.belofte}</Typography>
        <Stack direction="row" spacing={1}>
          <StandChip stand={belofte.stand} />
          <Chip size="small" variant="outlined" label={belofte.invariant} />
        </Stack>
      </Stack>

      <Stack spacing={1} sx={{ pl: { sm: 2 }, borderLeft: { sm: "3px solid" }, borderColor: { sm: "divider" } }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "72ch" }}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
            Waarom u ons niet hoeft te geloven.{" "}
          </Typography>
          {belofte.waarom}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "72ch" }}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
            Wat wij hierbij niet beloven.{" "}
          </Typography>
          {belofte.nietBeloofd}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function Beloftes() {
  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="h1">Wat wij beloven</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "62ch" }}>
          Elke belofte hieronder hoort bij een invariant uit de protocolspecificatie, en bij elke belofte staat hoe u
          hem zelf kunt narekenen. Staat er geen invariant achter, dan is het een voornemen en geen belofte, en dan
          hoort het in de derde regel: wat wij er niet bij beloven.
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "62ch" }}>
          Die derde regel is geen kleine lettertjes. Een standaard die meer belooft dan zij afdwingt, is precies het
          probleem dat dit project wil oplossen.
        </Typography>
      </Stack>

      {GROEPEN.map((groep) => (
        <Sectie key={groep.titel} titel={groep.titel} toelichting={groep.inleiding}>
          <Stack spacing={3} divider={<Divider flexItem />}>
            {groep.beloftes.map((b) => (
              <BelofteBlok key={b.invariant + b.belofte} belofte={b} />
            ))}
          </Stack>
        </Sectie>
      ))}

      <Sectie
        titel="Wat er nog niet af is"
        toelichting="Dit hoort op dezelfde pagina als de beloftes, en niet ergens onderaan in een document dat niemand leest."
      >
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          {OPENSTAAND.map((punt) => (
            <Stack key={punt.kop} spacing={0.75}>
              <Typography sx={{ fontWeight: 600 }}>{punt.kop}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "72ch" }}>
                {punt.tekst}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Sectie>

      <Typography variant="body2" color="text.secondary">
        De invarianten I1 tot en met I15 staan voluit in <code>spec/protocol.md</code>. Een implementatie is pas
        conform als zij voor elke invariant de bijbehorende test haalt. Alles staat open op{" "}
        <Link href="https://github.com/Knibbaz/openbod" target="_blank" rel="noreferrer">
          GitHub
        </Link>
        , dus u kunt deze pagina naast de code leggen.
      </Typography>
    </Stack>
  );
}
