# Architectuur: Open Transparant Bieden

Werktitel *OpenBod*. Dit document tekent de repo-structuur, de services en hun API-contract, en laat zien waar de timelock en de hashketen in de core zitten. Daarna staat de deployment-topologie (ieder een eigen core, plus hoe je aantoont dat iemand echt is aangesloten) en hoe je de core stabiel houdt.

## 0. Drie niveaus

- **Spec.** De NTA 8061 is de blauwdruk op eisen-niveau (minimale eisen aan het biedproces en het biedlogboek). De volledige tekst is gratis beschikbaar via open.overheid.nl en Rijksoverheid, dus je kunt er direct tegenaan bouwen. De NTA zegt *wat*, niet *hoe*. Jouw protocol (commit-reveal, timelock, hashketen) is het *hoe*, en gaat verder dan de NTA door de eisen bewijsbaar te maken in plaats van beloofd.
- **Implementatie.** De open source code in deze repo.
- **Deployment.** Eén draaiende instantie van die code, ergens gehost.

Let op: de NTA gaat ervan uit dat informatie realtime met de verkoper gedeeld kan worden. Jouw "verzegeld tot de deadline, ook voor de makelaar" is een verzwaring bovenop de NTA, geen NTA-eis. Bouw dus de NTA-verplichte velden en verkoopmethoden in, en zet de cryptografische verzegeling er als extra laag bovenop.

## 1. Repo-structuur (monorepo)

```
openbod/
  README.md
  ARCHITECTURE.md
  LICENSE                         # EUPL-1.2 of AGPL-3.0, nog te kiezen
  spec/
    protocol.md                   # versioned protocol-spec: de invarianten en het contract
    nta8061-mapping.md            # afbeelding op de NTA 8061 velden, methoden en logboek
    CHANGELOG.md
  packages/
    core/                         # het vertrouwensgevoelige hart, moet altijd werken
      src/
        model/                    # Bid, Listing, Voorbehoud, OvernameItem, LogEntry
        commit/                   # commitments en verzegelde payloads aannemen en bewaren
        timelock/                 # ontsleutelen op de deadline, valideren tegen commitment
        log/                      # append-only hashketen plus verificatie
        anchor/                   # root-hash publiceren naar de transparency-log
        reveal/                   # onthulling orkestreren op de deadline
        logbook/                  # NTA 8061-biedlogboek genereren en ondertekenen
        api/                      # HTTP-API
      test/
        invariants/               # property-based tests op de kerngaranties
    conformance/                  # gedeelde conformance-suite, draaibaar tegen elke instantie
    identity/                     # aparte auth-backend: magic link nu, iDIN later, OIDC-uitgever
    verifier/                     # standalone CLI/lib om een logboek onafhankelijk te verifieren
    transparency-log/             # de dunne, neutrale anchoring-dienst, alleen hashes
    web-demo/                     # kale referentie-frontend, reskinbaar, zelf te hosten
  deploy/
```

Suggestie voor de stack: TypeScript of Node voor core, identity en demo (drand timelock via `tlock-js`, hashketen is triviaal, Fastify voor de API, Postgres voor opslag). Go is een prima alternatief, met native drand. Houd de core klein en saai. Alle experiment hoort in adapters (identity, extra voorbehouden, frontend), niet in de core.

## 2. De drie services

| Service | Verantwoordelijkheid | Ziet bedragen vóór deadline |
|---|---|---|
| `core` | Commitments, timelock-onthulling, hashketen-logboek, biedlogboek, anchoring | Nee, niemand |
| `identity` | Authenticatie (magic link nu, iDIN later), tokens uitgeven | n.v.t. |
| `web-demo` | Kale UI die met de core en identity praat | n.v.t. |

De core bevat geen login-logica. Frontends zijn losse clients tegen de core-API, dus anderen kunnen hun eigen frontend bouwen of de referentie-frontend reskinnen.

## 3. Waar de timelock zit

Cruciaal punt: de versleuteling gebeurt bij de bieder (in de browser), niet in de core. Anders zou de core de leesbare inhoud een moment in handen hebben. De core krijgt dus nooit de leesbare inhoud te zien, alleen de versleutelde payload plus een commitment.

Flow:

1. **Client (browser).** Stel het bod samen. Bereken `commitment = H(bod_plaintext || salt)`. Versleutel `bod_plaintext` met een timelock naar de drand-ronde die hoort bij de deadline: `ciphertext = tlock.encrypt(bod_plaintext, deadlineRound)`. Stuur `{ commitment, ciphertext, identityToken }` naar de core.
2. **Core (`commit/`).** Bewaart `commitment` en `ciphertext`. Kan niets ontsleutelen. Schrijft een logregel "bod geplaatst" met alleen de `commitment`.
3. **Op de deadline (`timelock/` en `reveal/`).** drand publiceert de rondesleutel. Nu kan iedereen, dus ook de core, `plaintext = tlock.decrypt(ciphertext)`. De core valideert `H(plaintext || salt) == commitment`. Klopt het, dan wordt het onthulde bod in het logboek gezet. Klopt het niet, dan wordt het als ongeldig gemarkeerd. Geen bieder hoeft hiervoor online te zijn.

Zo is "de operator kan niet gluren" een eigenschap van de wiskunde, niet van een belofte.

## 4. Waar de hashketen zit

In `packages/core/src/log/`. Elke statuswijziging wordt een onwrikbare regel.

```ts
interface LogEntry {
  index: number;          // 0, 1, 2, ...
  timestamp: string;      // ISO 8601, gezet door de instantie
  type: "listing_opened" | "bid_placed" | "bid_adjusted"
      | "bid_withdrawn" | "listing_closed" | "bid_revealed";
  payloadHash: string;    // H van de bijbehorende data (bijv. de commitment)
  prevHash: string;       // entryHash van de vorige regel
  entryHash: string;      // H(index || timestamp || type || payloadHash || prevHash)
}
```

- `append(event)` voegt een regel toe en berekent `entryHash`.
- `verify(log)` herrekent de hele keten en faalt zodra één regel is gewijzigd, ingevoegd of verwijderd.
- `anchor/` publiceert periodiek de laatste `entryHash` (de root) naar de `transparency-log`. Alleen die hash, geen persoonsgegevens.

## 5. API-contract

### Core-API (gebruikt door frontends en biedsystemen)

| Methode en pad | Doel |
|---|---|
| `POST /listings` | Woning aanmaken: prijsvorm, deadline, verkoopmethode, regels, lijst van zaken |
| `GET /listings/{id}` | Publieke weergave: regels, deadline, overname-items, aantal biedingen indien aangezet. Nooit bedragen vóór de deadline |
| `POST /listings/{id}/bids` | Verzegeld bod plaatsen. Body `{ commitment, ciphertext, identityToken }`. Geeft een ondertekend ontvangstbewijs terug |
| `PATCH /listings/{id}/bids/{bidId}` | Bod aanpassen indien toegestaan. Nieuwe verzegelde versie, gelogd |
| `DELETE /listings/{id}/bids/{bidId}` | Bod intrekken indien toegestaan. Gelogd |
| `POST /listings/{id}/close` | Sluiten. Gebeurt automatisch op de deadline en start de onthulling |
| `GET /listings/{id}/logbook` | Na sluiting: het volledige, ondertekende biedlogboek plus verificatiedata |
| `GET /listings/{id}/proof/{bidId}` | Inclusiebewijs voor één specifiek bod |

Ontvangstbewijs bij `POST .../bids`:

```json
{
  "bidId": "…",
  "listingId": "…",
  "commitment": "…",
  "logIndex": 7,
  "prevHash": "…",
  "entryHash": "…",
  "timestamp": "2026-07-20T12:00:00Z",
  "instanceSignature": "…"
}
```

Hiermee kan een bieder later zelf bewijzen dat zijn bod op tijd en ongewijzigd in het logboek stond.

### Bod-datamodel

```ts
interface Bid {
  amount: number;                 // bedrag voor de woning
  handoverDate?: string;          // gewenste opleverdatum
  validUntil?: string;            // geldigheidsduur
  conditions: Voorbehoud[];       // voorbehouden
  motivation?: string;            // vrije tekst, alleen voor verkoper na onthulling
  takeover: OvernameChoice[];     // roerende zaken ter overname
}

interface Voorbehoud {
  type: "financieel" | "bouwdepot" | "bouwkundige_keuring"
      | "verkoop_eigen_woning" | "nhg" | "anders";
  deadline?: string;              // datum waarvoor dit geregeld moet zijn
  note?: string;
}

interface OvernameChoice {
  itemId: string;
  choice: "geen" | "gevraagd_bedrag" | "eigen_bod" | "in_overleg";
  amount?: number;                // bij eigen_bod
  underReservation?: boolean;     // bijv. afhankelijk van financiering
}
```

`amount`, `conditions`, `motivation` en `takeover` zitten allemaal binnen de getimelockte `ciphertext`. De core ziet ze pas na de deadline.

### Identiteitscontract

De identity-backend is een OIDC-uitgever. De core verifieert een ondertekend JWT en gebruikt alleen `sub`:

```json
{
  "iss": "https://identity.example",
  "sub": "pseudonieme-gebruikers-id",
  "aud": "openbod-core",
  "assurance_level": "email",     // later: "idin", "digid"
  "iat": 1750000000,
  "exp": 1750003600
}
```

Magic link nu geeft `sub = H(geverifieerd e-mailadres)` op niveau `email`. Later geeft iDIN een `sub` op een hoger `assurance_level`. De core verandert daar niet voor.

## 6. Deployment-topologie (ieder een eigen core, en toch verifieerbaar)

Niet doen: één centrale core op een overheidsserver die alle live biedingen bevat. Dat concentreert persoonsgegevens (AVG-honeypot), maakt de overheid de live operator met bijbehorende aansprakelijkheid en single point of failure, en creeert een monopolie-afhankelijkheid.

Wel doen: **federatie plus een dunne neutrale verifieerbaarheidslaag plus certificering.** Drie mechanismen maken "ben je echt aangesloten en conform" controleerbaar in plaats van beweerd:

1. **Draagbare ontvangstbewijzen.** Elke bieder en de verkoper krijgen bij sluiting een ondertekend logboek. Iedereen kan zelf de hashketen, de timelock-onthulling en de aanwezigheid van het eigen bod verifieren met de `verifier`. Een instantie die vals speelt, faalt de wiskunde. De gebruikers zijn de controleurs.
2. **Eén dunne publieke transparency-log (anchoring).** Elke instantie publiceert alleen root-hashes naar één gedeelde, neutrale, append-only publieke log. Alleen hashes, geen persoonsgegevens, dus AVG-veilig. Dit is het enige wat centraal mag staan, en juist dit past bij een overheid of stichting omdat het minimaal is. Gevolg: een instantie die conform claimt maar nooit anchort is detecteerbaar (er staat niets in de log), en de uitgegeven logboeken moeten kloppen met wat is geanchord (geen herschrijven achteraf).
3. **Certificering plus trust-list.** Een toetsende partij (NEN, ministerie of stichting) draait de conformance-suite tegen een implementatie en ondertekent de publieke sleutel van de instantie. "Conform claimen" wordt dan "een geldig, niet-ingetrokken certificaat tonen plus anchoren." Frontends en bieders kunnen dat certificaat controleren. Intrekbaar bij wangedrag.

Optioneel en zwaarder, voor later: reproduceerbare builds plus remote attestation (TEE) om te bewijzen dat de draaiende instantie de ongewijzigde core is.

Antwoord op je vraag dus: iedereen draait zijn eigen core, en je weet dat iemand echt is aangesloten doordat (a) zijn gebruikers een verifieerbaar bewijs in handen hebben, (b) hij aantoonbaar anchort in de gedeelde publieke log, en (c) hij een geldig conformance-certificaat draagt. Alleen die dunne log en de certificering staan centraal, en die bevatten geen biedingen.

## 7. De core stabiel houden

Jouw eis dat de core altijd werkt en dat wijzigingen streng getest worden, verankeren we in de structuur:

- **Spec los van implementatie.** `spec/protocol.md` legt de invarianten vast als stabiel contract. De implementatie mag veranderen, de invarianten niet zomaar.
- **Conformance-suite als eerste burger.** `packages/conformance` test elke instantie tegen de eisen. `core/test/invariants` doet property-based tests op de kerngaranties, onder andere: een bod is vóór de deadline nooit leesbaar, de hashketen verifieert altijd, een onthulling matcht altijd zijn commitment, geen bod kan verdwijnen of wijzigen zonder detectie.
- **Semver plus eeuwige verifieerbaarheid.** Breaking changes zijn een major versie. Oude logboeken moeten voor altijd verifieerbaar blijven, dus formaten zijn geversioneerd.
- **CI-poorten.** Geen merge zonder groene conformance-tests, property-tests en een reproduceerbare-build-check.
- **Governance voor core-wijzigingen.** Suggesties lopen via een korte RFC en moeten de tests halen voordat ze de stabiele pad raken. Zo blijven bijdragen welkom terwijl de core beschermd is.
