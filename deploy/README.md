# De demo-instantie draaien

Eén publieke demo-instantie, drie containers, één poort naar buiten. Bedoeld om te
kunnen klikken zonder te installeren — niet als productiesysteem. Zie
"Bewuste beperkingen" hieronder voordat je hier iets echts op zet.

## Starten

```
cp deploy/.env.example deploy/.env      # vul PUBLIC_URL in
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

De stack luistert standaard op `127.0.0.1:8080`. Zet er een reverse proxy met TLS
voor (Caddy, Traefik, nginx, of wat je host aanbiedt) die naar die poort wijst, en
laat `PUBLIC_URL` exact overeenkomen met de URL die de bezoeker in de balk ziet.

Lokaal uitproberen kan zonder proxy:

```
PUBLIC_URL=http://localhost:8080 docker compose -f deploy/docker-compose.yml up -d --build
```

## Op een eigen VPS

Eenmalig, als root of met sudo:

```
apt update && apt install -y docker.io docker-compose-plugin git
git clone https://github.com/Knibbaz/openbod.git /opt/openbod
cd /opt/openbod
cp deploy/.env.example deploy/.env
```

Zet in `deploy/.env` je eigen domein bij `PUBLIC_URL`. Laat `BIND_ADDRESS` op
`127.0.0.1` staan: de stack praat alleen met de proxy, niet met het open internet.

TLS met Caddy op de host, die meteen een certificaat regelt. In `/etc/caddy/Caddyfile`:

```
demo.jouwdomein.nl {
	reverse_proxy 127.0.0.1:8080
}
```

Dan starten, en als systemd-unit laten terugkomen na een herstart. In
`/etc/systemd/system/openbod.service`:

```ini
[Unit]
Description=OpenBod demo-instantie
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/openbod
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
ExecStop=/usr/bin/docker compose -f deploy/docker-compose.yml down
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
```

```
systemctl daemon-reload && systemctl enable --now openbod
```

Bijwerken na een nieuwe commit:

```
cd /opt/openbod && git pull && systemctl restart openbod
```

De containers hebben uitgaande toegang tot `api.drand.sh` nodig. Inkomend is alleen
443 voor de proxy nodig; poort 8080 hoort niet open te staan.

## Hoe het in elkaar zit

| Container | Wat het is | Naar buiten |
|---|---|---|
| `identity` | Magic-link-authenticatie, geeft ES256-JWT's uit | nee |
| `core` | Commitments, timelock, hashketen-logboek, onthulling | nee |
| `web` | Caddy: statische frontend plus reverse proxy | ja, poort 8080 |

Caddy zet alles op één origin, zodat de browser geen cross-origin-verkeer doet:

```
/               -> de statische React-build
/api/core/*     -> core:4000
/api/identity/* -> identity:4001
```

De naad tussen bieden en identiteit blijft echt: het zijn twee losse processen die
elkaar alleen via een geverifieerd token kennen (ARCHITECTURE.md §5). Dat `core`
de JWKS intern ophaalt (`http://identity:4001/...`) terwijl de issuer de publieke
URL is, is bewust: de issuer-claim is wat de bezoeker kan controleren.

## Waarom `PUBLIC_URL` op drie plekken staat

- **CORS-origin** voor core en identity.
- **JWT-issuer** (`IDENTITY_ISSUER`), die core exact zo verwacht. Wijkt hij af, dan
  weigert core elk token en kan niemand bieden.
- **Magic link** (`APP_BASE_URL`): waar de inloglink naartoe wijst.

## Bewuste beperkingen van deze instantie

Deze staan ook in de UI, maar hier expliciet, want ze zijn geen bugs:

- **Iedereen kan inloggen als elk e-mailadres.** Er is geen mailserver, dus
  `IDENTITY_DEMO_MODE=true` toont de magic link direct in de response. Op een
  instantie met echte biedingen moet deze schakelaar uit, en er een mailserver in.
- **Alles staat in het geheugen.** `packages/core/src/store.ts` is een
  in-memory-referentie. Herstart je de container, dan zijn de woningen, biedingen
  en logboeken weg.
- **De ondertekensleutel van de instantie is vluchtig.** `packages/identity/src/keys.ts`
  genereert bij elke start een nieuw sleutelpaar, dus bestaande tokens vervallen bij
  een herstart. Een echte instantie heeft een persistente sleutel met rotatiebeleid.
- **Geen publieke verankering.** De root-hash wordt nog nergens extern gepubliceerd
  (zie de backlog). De hashketen en de handtekening zijn er wel, en de losse
  `verifier`-CLI rekent ze na.

De timelock is géén vereenvoudiging: die praat met het echte publieke
drand-quicknet, ook hier. De container heeft dus uitgaande toegang tot
`api.drand.sh` nodig.

## Controleren of het werkt

```
curl -s $PUBLIC_URL/api/core/listings
curl -s $PUBLIC_URL/api/identity/.well-known/jwks.json
```

En na een onthulde woning, met het logboek uit de UI:

```
node packages/verifier/dist/cli.js logbook logboek.json
```

## Stoppen

```
docker compose -f deploy/docker-compose.yml down
```
