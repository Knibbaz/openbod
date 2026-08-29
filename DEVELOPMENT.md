# Aan de slag

MVP-implementatie van OpenBod: drie services (`identity`, `core`, `web-demo`) plus een losse
`verifier`-CLI, volgens `ARCHITECTURE.md` en `spec/protocol.md`.

## Vereisten

- Node.js ≥ 20
- Internettoegang naar `api.drand.sh` (het publieke drand quicknet-netwerk, periode 3s).
  Er draait geen eigen of lokale timelock; de MVP gebruikt het echte netwerk.

## Installeren en bouwen

```
npm install
npm run build --workspace packages/core
npm run build --workspace packages/verifier
```

## Draaien (drie terminals)

```
npm run dev --workspace packages/identity   # poort 4001
npm run dev --workspace packages/core       # poort 4000
npm run dev --workspace packages/web-demo   # poort 5173
```

Wil je de automatische verstrekking van het biedlogboek lokaal echt zien lopen, zet dan
in beide backends hetzelfde geheim:

```
IDENTITY_SUBJECT_PEPPER=$(openssl rand -hex 32) \\
  DELIVERY_SHARED_SECRET=lokaal-geheim npm run dev --workspace packages/identity
CORE_DELIVERY_ENDPOINT=http://localhost:4001/notify/logbook \
  DELIVERY_SHARED_SECRET=lokaal-geheim npm run dev --workspace packages/core
```

Zonder die variabelen waarschuwt de core alleen dat er niets verstuurd wordt. `IDENTITY_SUBJECT_PEPPER`
mag lokaal weg: dan maakt identity er zelf een aan, met een waarschuwing dat subjects bij elke herstart
veranderen. In productie start identity zonder pepper bewust niet op.

Open `http://localhost:5173`. Er is geen mailserver aangesloten: een "magic link"
wordt getoond in de UI en gelogd door `identity`, in plaats van gemaild.

## Testen

```
npm run test --workspace packages/core       # property- en integratietests, echte drand-calls
npm run test --workspace packages/identity   # pseudonieme subjects, snel
npm run test --workspace packages/verifier
```

De timelock-tests praten met het echte publieke netwerk en duren daardoor
enkele seconden per test (periode 3s). Er is bewust geen gemockte timelock:
het bewijs dat "de operator niet kan gluren" moet tegen het echte netwerk gelden.

## Wat de instantie werkelijk in handen heeft

`packages/core/test/invariants/geen-lek.test.ts` is de test die de kernclaim draagt. Hij
dumpt de complete objectgraaf van de store, inclusief Maps en interne velden, en zoekt
daarin naar de echte waarden: bedrag, motivatie, naam, contactgegeven. Vóór de deadline
komt geen ervan voor. Na de onthulling hoort het bedrag er wél te staan, naam en contact
nog steeds niet, ook niet na gunning.

De aanpak is expres bot. Een test die controleert of de bekende velden netjes versleuteld
zijn, bewijst alleen iets over de velden die je bedacht had. Deze bewijst dat de waarde
nergens staat, ook niet in een cache of in een veld dat later wordt toegevoegd. Dat de
test zelf werkt, blijkt uit de assertie dat de commitment wél in de dump te vinden is:
afwezigheid is dus echt afwezigheid, geen onbereikbaarheid.

`packages/identity/test/subject.test.ts` doet hetzelfde voor de andere helft van de claim:
een `sub` is niet uit een adres te raden zonder de pepper, ook niet met een woordenlijst.

## Frontend

### Twee omgevingen, gescheiden routes

De publieke kant is voor kopers, de beheerkant voor de verkoper en zijn makelaar. Dat is een
bewuste scheiding: op de vorige versie stond het biedformulier naast de gunningsknop op dezelfde
pagina, en dan is voor niemand duidelijk wie waar mag klikken.

```
/                 woningen, met foto, prijs en fase
/woningen/:id     koperpagina: foto's, kenmerken, aftelklok, bieden, uitslag
/login            inloggen via magic link
/uitleg           hoe de verzegeling werkt
/beheer           overzicht van je eigen woningen
/beheer/nieuw     woning klaarzetten
/beheer/:id       biedingen naast elkaar, gunnen, afsluiten
```

"Je eigen woningen" betekent: de woningen waarvan deze browser de verkopersleutel bewaart
(`listSellerKeyListingIds`). Er is geen serverbegrip van eigenaarschap, want de server weet niet
wie de verkoper is en hoort dat ook niet te weten. De keerzijde (op een ander apparaat zie je
niets) staat in de UI uitgelegd in plaats van dat de gebruiker een leeg scherm krijgt.

### Taal

Protocoljargon staat niet in de hoofdstroom. `bidId`, `entryHash` en `logregel #7` zitten in het
`Bewijspaneel`, dichtgeklapt, met in gewone taal ernaast wat ze betekenen. Dichtgeklapt is niet
verstopt: een koper die drie ton biedt wil weten óf het goed staat, niet welke hash erbij hoort,
maar het weglaten zou dit systeem net zo'n black box maken als de rest.

### Vormgeving

De demo-frontend gebruikt MUI (Material UI). Het thema staat in `packages/web-demo/src/theme.ts`: een
diepe, rustige blauwtint, en kleur die betekenis draagt in plaats van decoratie. Rood is voor fouten,
groen uitsluitend voor een geslaagde verificatie, oranje voor de fase waarin iets verzegeld en dus nog
niet leesbaar is. Nergens maakt kleur het ene bod aantrekkelijker dan het andere: de verkoper weegt zelf
zekerheid tegen hoogte, en de interface hoort daar geen duim op te leggen.

Licht en donker volgen het systeemthema van de bezoeker; er is bewust geen eigen schakelaar.

Let op bij MUI 9: `Stack` accepteert geen losse system props meer (`alignItems`, `flexWrap`,
`justifyContent`). Die horen in `sx`. Alleen `direction`, `spacing`, `divider` en `useFlexGap` staan nog
als eigen prop op het component.

## Zelf verifiëren

```
npm run build --workspace packages/verifier
node packages/verifier/dist/cli.js logbook logboek.json
```

`logboek.json` kun je downloaden vanaf de detailpagina van een onthulde woning in de demo.

## Een publieke instantie draaien

Zie `deploy/README.md`. Kort: `docker compose -f deploy/docker-compose.yml up -d --build`
met `PUBLIC_URL` gezet. Drie containers achter één Caddy-proxy, dus één origin en geen
CORS-configuratie.

## MVP-scope en bewuste vereenvoudigingen

Gebouwd (zie `spec/backlog.md` §"Prioritering voor de demo"): woning aanmaken met eigen
spelregels en lijst roerende zaken, magic-link login, verzegeld bod met het volledige
pakket uit README §6, één lopend bod per bieder dat je zelf kunt inzien, aanpassen en
intrekken, anoniem bieden met vrijgave bij gunning, automatische onthulling op de
deadline, hashketen-logboek, aantal-zichtbaar-regel, automatische verstrekking van het
biedlogboek bij een eindstatus, afhandeling buiten de procedure om met vastgelegde reden,
en de losse verifier.

Concepten worden bewust niet serverside bewaard. Zou de instantie een concept opslaan,
dan weet zij vóór de deadline dat iemand een bod voorbereidt, precies de
informatievoorsprong die dit project wil afschaffen. Een concept hoort dus in de browser
van de bieder te blijven en komt daarom niet in het logboek.

Nog niet gebouwd (zie backlog, "Later"): white-label opmaak, publieke transparency-log
(anchoring), pluggable iDIN-identiteit, certificering/trust-list, een tweede reskinbare
frontend, en het demoscenario (E8-S2) dat de garanties aan een bezoeker laat zien. Dat
laatste heeft nog echt werk nodig: de bewijzen bestaan als tests, maar de vorm waarin je
ze aan een bezoeker toont zonder dat de uitleg los kan lopen van de werkelijke uitvoer is
nog een open ontwerpvraag. Zie E8-S2 in de backlog voor de openstaande punten. De architectuur is er wel op ingericht (aparte `identity`-service, `anchor/`-module
als plek gereserveerd in `packages/core/src`).

Bewuste MVP-vereenvoudigingen, met wat er in productie anders zou moeten:

- **In-memory store.** `OpenBodStore` in `packages/core/src/store.ts` bewaart alles in het
  geheugen; een herstart wist de data. Productie vervangt dit door Postgres, zonder het
  API-contract te wijzigen.
- **Instantiesleutel per processtart.** `InstanceKeypair` genereert een nieuw Ed25519-paar
  bij elke start. Productie laadt een persistente sleutel en laat de publieke sleutel
  certificeren (ARCHITECTURE.md §6.3).
- **Automatische onthulling via polling.** Elke 2s checkt de API of een deadline verstreken
  is. Werkt voor de demo; productie gebruikt een betrouwbare scheduler.
- **Geen anchoring en geen certificering.** Alleen de instantie zelf ondertekent; er is nog
  geen gedeelde transparency-log of toetser (ARCHITECTURE.md §6.2 en §6.3).
- **Het logboek wordt niet echt gemaild.** De verstrekking zelf werkt volledig, inclusief
  de `logboek_verstuurd`-regel in de hashketen. Alleen de laatste stap schrijft naar de
  serverlog, want er is geen mailserver aangesloten (`sendLogbookMail` in
  `packages/identity/src/server.ts`). Zonder `CORE_DELIVERY_ENDPOINT` en
  `DELIVERY_SHARED_SECRET` verstuurt de core helemaal niets en zegt dat ook bij het starten.
- **Vluchtige subject-pepper.** Zonder `IDENTITY_SUBJECT_PEPPER` genereert identity er lokaal zelf een.
  Handig om te draaien, maar subjects veranderen dan bij elke herstart. In productie weigert de backend
  te starten zonder, want een zwakker pseudoniem stilletjes uitdelen ondermijnt de claim eronder.
- **Sub naar e-mail in het geheugen.** De identity-backend onthoudt die koppeling alleen
  voor wie tijdens deze processtart inlogde. Na een herstart is bezorging aan eerdere
  deelnemers onmogelijk tot zij opnieuw inloggen.
- **Motivaties zijn voor niemand zichtbaar.** Een bieder kan een motivatie meesturen en die is
  uitsluitend voor de verkoper bedoeld, maar er is geen endpoint dat haar teruggeeft. Dat is met
  opzet: zonder verkopersrol zou zo'n endpoint de motivatie aan iedere ingelogde gebruiker tonen.
  Dit hoort samen met de verkopersrol hieronder opgelost te worden, niet los.
- **Geen verkopersrol.** Woningen aanmaken en gunnen vragen geen verkopersauthenticatie.
  Bij gunning valt dat mee: wie de sleutel niet heeft, krijgt een envelop die hij niet kan
  openen, en de gunning staat onuitwisbaar in het logboek. Een echte instantie hoort hier
  bezit van de private sleutel te laten bewijzen.
- **Sleutel van de verkoper in localStorage.** Kwijt is kwijt, en dan blijft de identiteit
  van de winnende bieder onleesbaar. Productie geeft hier een herstelpad, maar nooit een
  sleutel die de operator ook heeft, want dan vervalt de hele garantie.
