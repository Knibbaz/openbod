# Aan de slag

MVP-implementatie van OpenBod: drie services (`identity`, `core`, `web-demo`) plus een losse
`verifier`-CLI, volgens `ARCHITECTURE.md` en `spec/protocol.md`.

## Vereisten

- Node.js ≥ 20
- Internettoegang naar `api.drand.sh` (het publieke drand quicknet-netwerk, periode 3s).
  Er draait geen eigen of lokale timelock — de MVP gebruikt het echte netwerk.

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

Open `http://localhost:5173`. Er is geen mailserver aangesloten: een "magic link"
wordt getoond in de UI en gelogd door `identity`, in plaats van gemaild.

## Testen

```
npm run test --workspace packages/core       # property- en integratietests, echte drand-calls
npm run test --workspace packages/verifier
```

De timelock-tests praten met het echte publieke netwerk en duren daardoor
enkele seconden per test (periode 3s). Er is bewust geen gemockte timelock:
het bewijs dat "de operator niet kan gluren" moet tegen het echte netwerk gelden.

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
deadline, hashketen-logboek, aantal-zichtbaar-regel, en de losse verifier.

Concepten worden bewust niet serverside bewaard. Zou de instantie een concept opslaan,
dan weet zij vóór de deadline dat iemand een bod voorbereidt — precies de
informatievoorsprong die dit project wil afschaffen. Een concept hoort dus in de browser
van de bieder te blijven en komt daarom niet in het logboek.

Nog niet gebouwd (zie backlog, "Later"): white-label opmaak, publieke transparency-log
(anchoring), pluggable iDIN-identiteit, certificering/trust-list, en een tweede reskinbare
frontend. De architectuur is er wel op ingericht (aparte `identity`-service, `anchor/`-module
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
- **Geen verkopersrol.** Woningen aanmaken en gunnen vragen geen verkopersauthenticatie.
  Bij gunning valt dat mee: wie de sleutel niet heeft, krijgt een envelop die hij niet kan
  openen, en de gunning staat onuitwisbaar in het logboek. Een echte instantie hoort hier
  bezit van de private sleutel te laten bewijzen.
- **Sleutel van de verkoper in localStorage.** Kwijt is kwijt, en dan blijft de identiteit
  van de winnende bieder onleesbaar. Productie geeft hier een herstelpad — maar nooit een
  sleutel die de operator ook heeft, want dan vervalt de hele garantie.
