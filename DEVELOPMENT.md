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

Gebouwd (zie `spec/backlog.md` §"Prioritering voor de demo"): woning aanmaken, magic-link
login, verzegeld bod, automatische onthulling op de deadline, hashketen-logboek,
aantal-zichtbaar-regel, gunningsoverzicht (ruwe data via de API), en de losse verifier.

Let op het verschil tussen core en frontend bij de inhoud van een bod. De core en het
protocol ondersteunen het volledige pakket uit README §6 — bedrag, opleverdatum,
geldigheidsduur, voorbehouden, motivatie en overname-keuzes — en `bidPayloadSchema`
valideert dat na de onthulling opnieuw. Het biedformulier in `web-demo` vraagt op dit
moment alleen om bedrag en motivatie. Wie het hele pakket wil zien, moet dus via de API
of via `sealBid` uit `@openbod/core` werken; het formulier loopt achter op de core.

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
