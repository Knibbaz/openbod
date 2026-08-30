# Stand van zaken

Wat er werkt, wat er open staat, en welke beslissingen er nog genomen moeten worden.

`spec/backlog.md` zegt wat er zou moeten zijn; dit bestand zegt wat er is. De statussen hieronder zijn afgeleid uit de code, niet uit de backlogtekst. `DEVELOPMENT.md` beschrijft de bewuste beperkingen van de referentie-implementatie, `deploy/README.md` die van een draaiende instantie.

Bijgewerkt op 30 augustus 2026.

**Gebouwd** betekent werkend en gedekt door een test. **Deels** betekent dat het contract er ligt maar de invulling niet. **Kritiek** betekent dat het ontbreken ervan een belofte raakt die het systeem wel doet.

---

## Wat er als eerste moet gebeuren

### Uitrollen naar een instantie

In deze volgorde, want stap 3 breekt als stap 2 niet gebeurd is: de core schrijft nu naar `/data` en start niet zonder dat volume.

1. **Handmatig één bod uitbrengen, lokaal.** Het biedformulier is naar `components/Biedmodule.tsx` verhuisd en er zijn geen frontendtests. Types, lint en een render buiten de browser zijn gecontroleerd; er is nooit een bod door het formulier geklikt. `npm run dev:web`.
2. **De VPS-compose vervangen door de repo-versie.** Draait daar een handmatig aangepaste kopie, gebruik dan `deploy/docker-compose.yml` plus `deploy/docker-compose.proxy.yml`, met `PROXY_NETWORK` in `deploy/.env`. Neem beide `-f` vlaggen mee bij élke `up -d` en `pull`, anders valt de stack terug op de gewone opzet.
3. **Volumes en paden zetten.** `core-data` en `identity-data` op `/data`, plus `CORE_DB_PATH` en `IDENTITY_DB_PATH`.
4. **De twee ondertekensleutels invullen.** `CORE_SIGNING_KEY` en `IDENTITY_SIGNING_JWK`. Zonder die sleutels is een gisteren gedownload logboek vandaag niet meer te verifiëren, en dat is precies het soort "u moet ons maar geloven" dat dit project wil uitbannen. Generatiecommando's staan in `deploy/.env.example`.
5. **Images publiceren.** Een push naar `main` draait de tests en duwt `latest` plus `sha-<commit>`. Op de instantie daarna `pull` en `up -d`; zonder `pull` blijft de oude `latest` draaien.
6. **Back-up inrichten.** Een volume overleeft een herstart, geen kapotte schijf. Nachtelijke `VACUUM INTO` van beide databases naar een andere machine; het commando staat in `deploy/README.md`.

### Als je één story kiest

**E16-S1**, de afloop van een gunning vastleggen. De voorbehouden staan al verzegeld in het bod en al in het openbare logboek, dus het kost alleen nieuwe logregels, en het sluit een gat in iets wat het systeem nu al belooft.

---

## Beslissingen die nog genomen moeten worden

Deze raken het datamodel of de belofte en zijn later niet meer goedkoop terug te draaien.

| Waar | Vraag |
|---|---|
| E12-S2 | Meerdere `sellerSub`-waarden, of één verkopende partij waar meerdere accounts aan hangen? En mag de identiteitsenvelop naar meerdere sleutels versleuteld worden, of delen erfgenamen er één? Dit zit in `Listing` en in de gunning. |
| E17 | Geldt de harde regel dat geen enkel endpoint een bezichtiging aan een bod mag koppelen, en dat aanwezigheid alleen meetelt als de bezoeker het zelf bevestigt? |
| E7-S3 | Voorrang voor starters of mensen uit de gemeente staat niet in de opsomming van de gelijkebehandelingswet, maar kan in een homogene gemeente feitelijk op afkomst selecteren. Dat is indirect onderscheid. Dit hoort langs een jurist voordat het op echte woningen draait. |
| E11 | Een consumentenbod is in Nederland niet bindend tot de akte. Zonder die binding kan een bod de prijs opdrijven en daarna verdwijnen, precies het nepbod dat verzegeld bieden onmogelijk maakt. Wat vervangt de Noorse wettelijke binding? |
| — | Moet de core in productie weigeren te starten zonder `CORE_SIGNING_KEY`, zoals identity dat al doet zonder pepper? Dat haalt "we hebben herstart" weg als manier om bewijs te wissen. Klein werk. |

---

## De vier gaten in de belofte

Deze staan ook op de beloftespagina in de frontend, want ze horen naast de beloftes en niet onderaan in een document dat niemand leest.

**1. Verankering ontbreekt (E4-S2).** Het belangrijkste dat er niet is. `packages/core/src/anchor/` bestaat niet, terwijl ARCHITECTURE.md §4 hem al beschrijft. De hashketen is intern sluitend, maar niets buiten de instantie legt vast hoe zij er gisteren uitzag. Wie de ondertekensleutel heeft, kan de hele keten opnieuw opbouwen. Tot die tijd is een bewaard ontvangstbewijs de sterkste controle die een bieder heeft.

**2. De code die verzegelt komt van de instantie (E9-S5).** Het verzegelen gebeurt in de browser, maar de pagina die dat doet wordt door de instantie geleverd. JavaScript dat het bedrag óók onversleuteld meestuurt omzeilt alles, en geen enkel ontvangstbewijs laat dat zien. Voorbereid: alles wat het bod in leesbare vorm aanraakt zit nu in één module met het ontvangstbewijs als enige uitgang.

**3. De sleutel van de verkoper is kwijt als de browser leeg is (E12-S1).** Dan blijft de identiteit van de winnende bieder onleesbaar en kan de verkoper zijn eigen verkoop niet afronden. Bij ruim een derde 65-plus verkopers, erfgenamen inbegrepen, is dat geen randgeval.

**4. Niemand toetst of certificeert een instantie (E9-S1, E9-S2).** `packages/conformance` bestaat nog niet. Je kunt narekenen dát een instantie zich aan haar eigen logboek houdt, niet of iemand haar heeft goedgekeurd.

---

## Register

### E1. Woning en dossier

| | | |
|---|---|---|
| E1-S1 | Woning toevoegen | Gebouwd |
| E1-S2 | Vragenlijst online laten invullen | Open |
| E1-S3 | White-label opmaak. Er is één vast thema, niet instelbaar per makelaar | Open |
| E1-S4 | Adres opzoeken in de BAG | Gebouwd |
| E1-S5 | Aanbod importeren. Loont pas als er een makelaar aan tafel zit | Open |

### E2. Verzegeld bieden

| | | |
|---|---|---|
| E2-S0 | Lekcheck over de volledige toestand | Gebouwd |
| E2-S1 | Een verzegeld bod plaatsen | Gebouwd |
| E2-S2 | Voorbehouden, motivatie en overname in het bod | Gebouwd |

### E3. Onthulling

| | | |
|---|---|---|
| E3-S1 | Automatische onthulling op de deadline | Gebouwd |
| E3-S2 | Validatie tegen de commitment | Gebouwd |

### E4. Onwrikbaar logboek

| | | |
|---|---|---|
| E4-S1 | Hashketen | Gebouwd |
| E4-S2 | Verankering | **Kritiek** |
| E4-S3 | Automatisch biedlogboek versturen | Gebouwd |

### E5. Identiteit

| | | |
|---|---|---|
| E5-S1 | Login via magic link | Gebouwd |
| E5-S2 | Pluggable identiteit. De core kent alleen een `sub` uit een ondertekend token, dus het contract klopt; alleen magic link is gebouwd | Deels |

### E6. Regels en zichtbaarheid

| | | |
|---|---|---|
| E6-S1 | Intrekken of aanpassen vóór de deadline | Gebouwd |
| E6-S2 | Zichtbaarheid van het aantal biedingen | Gebouwd |
| E6-S3 | Logboek meelezen tijdens de biedfase. Er is geen endpoint dat de keten tijdens de biedfase teruggeeft | Open |

### E7. Gunning en afronding

| | | |
|---|---|---|
| E7-S1 | Biedingen bekijken en gunnen | Gebouwd |
| E7-S2 | Afhandeling buiten de procedure om | Gebouwd |
| E7-S3 | Bekendgemaakte voorkeur van de verkoper. Wacht op de juridische toets | Open |
| E7-S4 | Pseudoniem profiel bij de onthulling | Open |

### E8. Verificatie voor gebruikers

| | | |
|---|---|---|
| E8-S1 | Zelf een bod en logboek verifiëren | Gebouwd |
| E8-S2 | Demoscenario dat de garanties laat zien | Gebouwd |
| E8-S3 | Bewijs op papier | Gebouwd |

### E9. Federatie en conformiteit

| | | |
|---|---|---|
| E9-S1 | Conformance-suite. `packages/conformance` bestaat niet | Open |
| E9-S2 | Certificaat en trust-list | Open |
| E9-S3 | Bieden zonder de frontend, via een CLI. Goedkoopste sterke maatregel, want het meeste bestaat al in `@openbod/core` | Open |
| E9-S4 | Erkende getuigen en de chain hash in het logboek | Open |
| E9-S5 | Afgeschermde biedmodule. De grens ligt er, de afscherming nog niet | Deels |
| E9-S6 | Gedragscontrole van een draaiende instantie | Open |
| E9-S7 | Publiek register | Open |

### E10. Presentatie en white-label

| | | |
|---|---|---|
| E10-S1 | Zelf te hosten frontend. Losse client tegen de API, maar thema en teksten zijn nog niet instelbaar | Deels |

### E11. Open bieden

| | | |
|---|---|---|
| E11-S1 | Openbaar bieden naar Noors voorbeeld. Drie openstaande vragen, waarvan de bindingsvraag de zwaarste | Open |

### E12. Vertegenwoordiging en sleutelbeheer

| | | |
|---|---|---|
| E12-S1 | Sleutel per account met een herstelpad dat de operator niet heeft | **Kritiek** |
| E12-S2 | Gemachtigde en erfgenamen. Wacht op een ontwerpbeslissing | Open |

### E13. Toegankelijkheid voor een vergrijzende markt

| | | |
|---|---|---|
| E13-S1 | Verzegelen meten op een oud apparaat. Nooit gemeten; duurt het tien seconden zonder voortgang, dan haakt iemand af vlak voor de sluitingstijd | Open |
| E13-S2 | Geen verzending die van een open tabblad afhangt | Besloten en uitgevoerd |

### E14. Andere dossiers op hetzelfde protocol

| | | |
|---|---|---|
| E14-S1 | Dossierprofiel in plaats van een vast huizendossier. De goedkope helft: de dossierhash is al generiek van vorm | Open |
| E14-S2 | Vakantiehuis verkopen als eerste extra profiel. Dagen werk zodra E14-S1 er is | Open |

### E15. Verifieerbare loting bij nieuwbouw

| | | |
|---|---|---|
| E15-S1 | Loting die iedereen zelf kan naspelen. Drand is er al en is precies hiervoor gebouwd. Belanghebbende is de gemeente, niet de ontwikkelaar | Open |

### E16. Na de gunning

| | | |
|---|---|---|
| E16-S1 | De afloop van een gunning vastleggen. De voorbehouden staan al in het logboek, dus dit kost alleen nieuwe regels | Open |

### E17. Bezichtigingen tellen

| | | |
|---|---|---|
| E17-S1 | Verifieerbare inschrijving voor een bezichtiging. Wacht op het besluit over de koppelingsregel | Open |
