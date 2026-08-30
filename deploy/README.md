# De demo-instantie draaien

Eén publieke demo-instantie, drie containers, één poort naar buiten. Bedoeld om te
kunnen klikken zonder te installeren, niet als productiesysteem. Zie
"Bewuste beperkingen" hieronder voordat je hier iets echts op zet.

## Starten

```
cp deploy/.env.example deploy/.env      # vul PUBLIC_URL in
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Zet `DEMO_INSTANCE=true` in `deploy/.env` als dit een demonstratie is. Dan vult de
core zichzelf met een scenario van vijf woningen in verschillende fasen en wist zij
zichzelf elk half uur, en toont identity de magic link op het scherm in plaats van
hem te mailen. Dat laatste betekent dat iedereen kan inloggen als elk e-mailadres,
dus laat dit uit op een instantie waar echte biedingen binnenkomen; die heeft dan
wel een mailserver nodig.

De stack luistert standaard op `127.0.0.1:8080`. Zet er een reverse proxy met TLS
voor (Caddy, Traefik, nginx, of wat je host aanbiedt) die naar die poort wijst, en
laat `PUBLIC_URL` exact overeenkomen met de URL die de bezoeker in de balk ziet.

Lokaal uitproberen kan zonder proxy:

```
PUBLIC_URL=http://localhost:8080 docker compose -f deploy/docker-compose.yml up -d --build
```

## Achter een Caddy die er al staat

Draait er al een Caddy-container voor andere sites, dan hoeft die van jou niets
te weten van poorten: zet deze stack op het netwerk van die proxy en verwijs naar
de containernaam.

Zoek eerst op hoe dat netwerk bij Docker heet. Compose zet het projectvoorvoegsel
ervoor, dus een `routd-network` in `routd-app/docker-compose.yaml` heet
`routd-app_routd-network`:

```
docker network ls
```

Zet die naam in `deploy/.env` en start met het extra bestand erbij:

```
PROXY_NETWORK=routd-app_routd-network
```

```
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.proxy.yml \
  --env-file deploy/.env up -d
```

Dat bestand zet de webcontainer op beide netwerken en haalt de poortmapping weg,
want die is dan overbodig. Neem het bij elke `up -d` en `pull` mee, anders valt
de stack terug op de gewone opzet en kan de proxy hem niet meer vinden.

`docker network connect caddy ...` doet hetzelfde in één commando, maar die
verbinding leg je met de hand en hij is weg zodra de proxycontainer opnieuw
wordt aangemaakt. Dan staat je site er ineens uit zonder dat je iets aan
openbod veranderd hebt.

En in het Caddyfile:

```
openbod.example.nl {
    reverse_proxy openbod-demo-web-1:8080
}
```

Let op het ontbreken van `http://` voor de hostnaam. Schrijf je dat er wel bij,
dan regelt Caddy geen certificaat en is de site alleen over http bereikbaar, en
**dan werkt het bieden niet**. Alles wat dit systeem belooft gebeurt in de
browser van de bieder: verzegelen, de identiteit versleutelen naar de verkoper,
de hashketen narekenen. Dat loopt via Web Crypto, en browsers geven `crypto.subtle`
alleen vrij op https of localhost. Op http bestaat die functionaliteit niet, en
dan is dit een website die woningen laat zien en verder niets. De frontend zegt
dat zelf ook, met een rode balk bovenaan, in plaats van pas te struikelen als
iemand een bod probeert uit te brengen.

Zet daarna in `deploy/.env`:

```
PUBLIC_URL=https://openbod.example.nl
DEMO_INSTANCE=true
```

`PUBLIC_URL` moet exact de URL zijn die de bezoeker in de balk ziet, https en al:
hij is tegelijk de CORS-origin, de JWT-issuer en de basis van de magic link.
Wijkt hij af, dan weigert de core elk token en kan niemand bieden. Zonder
`DEMO_INSTANCE=true` kan op een demo-instantie niemand inloggen, want er is geen
mailserver om de magic link te versturen.

De poortmapping (`BIND_ADDRESS`, `PUBLIC_PORT`) doet in deze opzet niets meer:
`docker-compose.proxy.yml` haalt hem weg omdat het verkeer over het Docker-netwerk
loopt. Gebruik je die opzet niet, laat `BIND_ADDRESS` dan op `127.0.0.1` staan en
nooit op `0.0.0.0`, want dan is de instantie ook rechtstreeks over http bereikbaar,
langs je certificaat heen.

## Bijwerken: images ophalen of zelf bouwen

Beide werken met dezelfde `docker-compose.yml`. Op een VPS zou ik het eerste doen.

```
# Gepubliceerde images ophalen (aanbevolen op een VPS)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d

# Of zelf bouwen uit de broncode
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Waarom ophalen boven bouwen: een build vraagt op een kleine VPS meer geheugen dan
je denkt, en een build die halverwege omvalt laat een instantie achter die niet
meer klopt met de code. De images worden gebouwd door
`.github/workflows/publish.yml`, die eerst de tests draait, dus wat je ophaalt is
een versie die het deed. Zelf bouwen blijft de juiste weg als je lokaal aan de
code werkt, of als je host op ARM draait en er alleen amd64-images gepubliceerd
zijn.

`pull` is niet optioneel bij de eerste manier: `up -d` gebruikt een `latest` die
al op de machine staat en merkt niet dat er een nieuwe is.

Terugrollen na een slechte deploy: zet `OPENBOD_TAG` in `deploy/.env` op een
versie of een commit (`v0.2.0`, `sha-1a2b3c4`) en draai `pull` plus `up -d`
opnieuw. Daarom publiceert de workflow naast `latest` ook die twee.

### Zelf publiceren

De workflow duwt naar Docker Hub onder de naam uit `DOCKERHUB_USERNAME`, dus
`<gebruiker>/openbod-api` en `<gebruiker>/openbod-web`. Eenmalig instellen in de
repo onder Settings, Secrets and variables, Actions:

- `DOCKERHUB_USERNAME`: je Docker Hub-gebruikersnaam.
- `DOCKERHUB_TOKEN`: een access token uit Docker Hub (Account Settings, Personal
  access tokens), niet je wachtwoord.

Elke push naar `main` levert `latest` en `sha-<commit>`. Een git-tag die met `v`
begint levert daarnaast de versienummers: `git tag v0.2.0 && git push --tags`.

## Wat een herstart wist

**Er is geen database.** `packages/core/src/store.ts` houdt alles in het geheugen,
dus elke `up -d` die containers vervangt, en elke reboot van de VPS, wist de
woningen, de biedingen en de logboeken. Voor een demo-instantie is dat geen
bezwaar; die zet zichzelf toch elk half uur terug. Voor een instantie waar echte
biedingen op binnenkomen is het een blokkade, en dan is Postgres achter dezelfde
`OpenBodStore` de eerste stap.

Twee dingen die je wél kunt vastzetten, en die je ook moet vastzetten als de
instantie blijft staan:

- `CORE_SIGNING_KEY`: de sleutel waarmee de instantie logboeken en
  ontvangstbewijzen ondertekent. Zonder deze maakt de core bij elke start een
  nieuwe, en dan faalt de verificatie van een logboek dat iemand gisteren
  downloadde: de handtekening hoort bij een sleutel die niet meer bestaat. Dat is
  precies het soort "u moet ons maar geloven" dat dit project wil uitbannen.
- `IDENTITY_SIGNING_JWK`: de sleutel waarmee inlogtokens ondertekend worden.
  Zonder deze is iedereen na een herstart uitgelogd.

Beide staan met een generatiecommando in `deploy/.env.example`.

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

## Na een wijziging opnieuw uitrollen

```
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

`--build` is hier het woord dat ertoe doet. `--force-recreate` maakt nieuwe containers van de
image die er al ligt en bouwt dus niets opnieuw: je krijgt precies dezelfde frontend terug, ook
als de broncode veranderd is. Wil je zeker weten dat er niets uit de cache komt, gebruik dan
`--build --no-cache`.

Controleren wat er nu echt geserveerd wordt:

```
curl -s $PUBLIC_URL | grep -o '/assets/[^"]*\.js'
```

Verandert die bestandsnaam niet na een build, dan is de bundel niet vernieuwd.

## Pseudonieme subjects

`IDENTITY_SUBJECT_PEPPER` is het geheim waarmee een e-mailadres naar de `sub` gaat die
de core als enige identiteitsgegeven ziet. Zonder pepper zou dat `sha256(adres)` zijn,
en dat is met een lijst kandidaat-adressen gewoon terug te rekenen. De identity-backend
weigert daarom in productie te starten als de pepper ontbreekt of korter is dan 32 bytes.

Wissel je de pepper, dan krijgt iedereen een nieuwe `sub` en zijn bestaande biedingen
niet meer aan hun bieder te koppelen. Behandel hem dus als een sleutel, niet als een
instelling.

## Automatische verstrekking van het biedlogboek

Zodra een woning een eindstatus bereikt (gegund of buiten de procedure afgehandeld)
stuurt de core het logboek vanzelf naar alle betrokkenen. Daarvoor moeten
`CORE_DELIVERY_ENDPOINT` en `DELIVERY_SHARED_SECRET` gezet zijn; ontbreken ze, dan
waarschuwt de core bij het starten en wordt er niets verstuurd.

De core kent geen e-mailadressen en hoort ze niet te kennen. Zij stuurt pseudonieme
subjects naar `identity`, die als enige de koppeling naar een adres heeft. Het gedeelde
geheim beschermt dat endpoint: zonder geheim zou iedereen ermee kunnen uitvragen of
een sub bekend is.

## Waarom `PUBLIC_URL` op drie plekken staat

- **CORS-origin** voor core en identity.
- **JWT-issuer** (`IDENTITY_ISSUER`), die core exact zo verwacht. Wijkt hij af, dan
  weigert core elk token en kan niemand bieden.
- **Magic link** (`APP_BASE_URL`): waar de inloglink naartoe wijst.

## Bewuste beperkingen van deze instantie

Deze staan ook in de UI, maar hier expliciet, want ze zijn geen bugs:

- **Iedereen kan inloggen als elk e-mailadres**, zolang `DEMO_INSTANCE=true` staat.
  Er is geen mailserver, dus de magic link komt direct in de response. Op een
  instantie met echte biedingen moet deze schakelaar uit, en er een mailserver in.
  Sinds deze schakelaar bestaat, staat hij standaard uit: een compose die je zonder
  nadenken overneemt, zet geen open deur voor je klaar.
- **De demo wist zichzelf**, ook met `DEMO_INSTANCE=true`. Elk half uur verdwijnt
  alles wat er staat, inclusief biedingen van bezoekers. Dat staat in de UI, zodat
  niemand zijn ontvangstbewijs kwijtraakt zonder gewaarschuwd te zijn.
- **Alles staat in het geheugen.** `packages/core/src/store.ts` is een
  in-memory-referentie. Herstart je de container, dan zijn de woningen, biedingen
  en logboeken weg.
- **Zonder `CORE_SIGNING_KEY` en `IDENTITY_SIGNING_JWK` zijn de sleutels vluchtig.**
  Dan genereren core en identity er bij elke start nieuwe: bestaande tokens vervallen
  en eerder verstrekte logboeken zijn niet meer te verifieren. Zie "Wat een herstart
  wist" hierboven. Rotatiebeleid (meerdere geldige sleutels tegelijk, netjes uitfaseren)
  is er nog niet.
- **Geen publieke verankering.** De root-hash wordt nog nergens extern gepubliceerd
  (zie de backlog). De hashketen en de handtekening zijn er wel, en de losse
  `verifier`-CLI rekent ze na.
- **Het logboek wordt niet echt gemaild.** De automatische verstrekking (E4-S3)
  werkt volledig: de core stuurt de bezorgopdracht naar identity en legt de
  verzending vast als `logboek_verstuurd` in de hashketen. Alleen de laatste stap,
  het daadwerkelijke mailen, schrijft naar de serverlog omdat er geen mailserver
  is aangesloten. Zie `sendLogbookMail` in `packages/identity/src/server.ts`.

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
