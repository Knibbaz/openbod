# OpenBod protocol-spec

Versie 0.1 (concept). Dit is het stabiele contract. De implementatie mag veranderen, de invarianten hieronder niet zomaar. De property-tests, de audit en de conformance-suite toetsen tegen dit document. Taal is Nederlands voor nu, te vertalen naar Engels voor een NGI-aanvraag.

## 1. Doel en afbakening

OpenBod legt vast hoe een verzegeld biedproces op een woning verloopt, zo dat het proces achteraf voor iedereen controleerbaar is en geen enkele partij op haar woord geloofd hoeft te worden. De spec beschrijft het gedrag en de garanties, niet een specifieke programmeertaal of database.

Buiten scope: prijsvorming, taxatie, de financiele afwikkeling bij de notaris, en de vraag wie mag bieden. Identiteit is een losse laag met een eigen contract (paragraaf 7).

## 2. Rollen

- Bieder: brengt een verzegeld bod uit.
- Verkoper: stelt de woning en de regels in en gunt na afloop.
- Makelaar: begeleidt namens de verkoper, kan bedragen vóór de deadline niet zien.
- Operator: draait een instantie van de software.
- Toetser: certificeert een implementatie tegen deze spec.
- Publiek: kan het logboek, de builds en de anchors verifieren.

## 3. Invarianten

Dit is de kern. Elke invariant is een eigenschap die altijd moet gelden en die machinaal getest wordt.

- **I1 Verzegeling.** Vóór de deadline kan geen enkele partij, ook de operator niet, de inhoud van een bod afleiden uit wat is opgeslagen.
- **I2 Bindende commitment.** Een onthuld bod moet overeenkomen met zijn commitment. Een ander bod kan niet in de plaats worden gezet.
- **I3 Onwrikbaar logboek.** Het logboek is append-only en tamper-evident. Elke invoeging, wijziging of verwijdering is detecteerbaar.
- **I4 Deadline-gestuurde onthulling.** De ontsleutelsleutel bestaat niet vóór de deadline en is erna voor iedereen beschikbaar.
- **I5 Volledigheid.** Elke geaccepteerde actie (plaatsen, aanpassen, intrekken) levert precies één logregel op. Niets dat geaccepteerd is, blijft ongelogd.
- **I6 Geen stille draft.** Een geaccepteerd bod kan niet ongemerkt verdwijnen. Aanpassen maakt een nieuwe versie, de oude versie blijft in de historie.
- **I7 Verifieerbaar ontvangstbewijs.** Elk geaccepteerd bod levert een ontvangstbewijs op dat de bieder zelf tegen het logboek kan verifieren.
- **I8 Anchoring-consistentie.** Een gepubliceerd logboek moet kloppen met de geanchorde root-hashes. Herschrijven achteraf is zichtbaar.
- **I9 Regeltransparantie.** De procesregels (intrekken, aanpassen, zichtbaarheid van het aantal, wie inzage heeft) staan vast bij het aanmaken van de woning, zijn zichtbaar, en kunnen niet halverwege veranderen.
- **I10 Identiteitsonafhankelijkheid.** De integriteitsgaranties gelden ongeacht de gebruikte identiteitsmethode.
- **I11 Privacy.** Motivatie en persoonsgegevens komen niet in het openbare logboek. In de gedeelde publieke log staan alleen hashes.
- **I12 Anonimiteit tot gunning.** De identiteit van een bieder is voor de operator en de makelaar op geen enkel moment leesbaar, en is voor de verkoper pas beschikbaar nadat hij aan die bieder gunt. Vrijgave is een gelogde gebeurtenis.

## 4. Fasen (toestandsmachine)

```
[aangemaakt] --open--> [biedfase] --deadline--> [gesloten]
    --onthulling--> [onthuld] --gunning--> [onherroepelijk]
```

- **Aangemaakt.** Woning en regels zijn vastgelegd. Regels zijn vanaf hier onveranderlijk (I9).
- **Biedfase.** Bieders plaatsen, en indien toegestaan passen aan of trekken in. Alleen commitments en ciphertext worden opgeslagen (I1). Elke actie wordt gelogd (I5, I6).
- **Gesloten.** Op de deadline worden geen nieuwe of gewijzigde biedingen meer geaccepteerd.
- **Onthuld.** De timelock-sleutel is beschikbaar, biedingen worden ontsleuteld en tegen hun commitment gevalideerd (I2, I4). Het biedlogboek wordt gegenereerd en verstuurd (I11).
- **Onherroepelijk.** Na gunning en het verlopen van bedenktijd en voorbehouden. Het logboek is definitief.

Toegestane overgangen zijn alleen die in het diagram. Elke andere overgang is een fout.

## 5. Commit- en reveal-mechaniek

Zij `bod` de canonieke serialisatie van het volledige biedpakket (bedrag, voorbehouden, opleverdatum, geldigheidsduur, overname, motivatie) en `salt` een willekeurige waarde per bod.

- Commitment: `commitment = H(bod || salt)`, met H een veilige hashfunctie (SHA-256).
- Verzegeling: `ciphertext = tlock_encrypt(bod || salt, ronde(deadline))`, uitgevoerd bij de bieder, niet bij de operator.
- Onthulling: op de deadline geeft de beacon de rondesleutel vrij, waarna `bod || salt = tlock_decrypt(ciphertext)`. De instantie controleert `H(bod || salt) == commitment`. Bij mismatch wordt het bod ongeldig gemarkeerd en gelogd.

De canonieke serialisatie moet deterministisch zijn, zodat de hash reproduceerbaar is.

## 5a. Identiteitsenvelop (anoniem bieden)

De timelock maakt een bod op de deadline voor iedereen leesbaar. De identiteit van de bieder hoort daar juist niet bij: die mag de operator nooit zien, en de verkoper pas bij gunning. Zij reist daarom in een tweede, apart versleutelde envelop naast het bod, niet erin.

Bij het aanmaken van de woning genereert de verkoper een sleutelpaar. De publieke sleutel staat bij de woning; de private sleutel verlaat het apparaat van de verkoper niet en komt dus nooit bij de operator.

- Envelop: `identityEnvelope = enc(pk_verkoper, {naam, contact})`, versleuteld bij de bieder.
- De instantie slaat de envelop ondoorzichtig op. Zij komt niet in enige publieke weergave en niet in het biedlogboek.
- Bij gunning geeft de instantie uitsluitend de envelop van het gegunde bod vrij, en logt dat als `identiteit_vrijgegeven`.

**Wat dit wel en niet garandeert.** Cryptografisch afgedwongen is dat operator en makelaar de identiteit nooit kunnen lezen: zij hebben de sleutel niet, op geen enkel moment. Niet cryptografisch afgedwongen is dat de verkoper pas bij gunning kijkt — hij houdt de private sleutel de hele tijd, dus hij kán eerder ontsleutelen wat hij in handen krijgt. Dat "pas bij gunning" is dus een procedurele en gelogde garantie, geen wiskundige. Wie dat wel wiskundig wil, heeft een derde partij of een threshold-schema nodig; dat is een bewuste toekomstige uitbreiding, geen stilzwijgende aanname.

Deze eerlijkheid is opzettelijk: een standaard die meer belooft dan zij afdwingt, is precies het probleem dat dit project wil oplossen.

## 6. Logboek

Elke logregel heeft de vorm uit ARCHITECTURE.md: `{ index, timestamp, type, payloadHash, prevHash, entryHash }`, met `entryHash = H(index || timestamp || type || payloadHash || prevHash)`. De root is de laatste `entryHash`. Verificatie herrekent de keten en vergelijkt de root met de geanchorde waarde (I3, I8).

Het openbare biedlogboek bevat de NTA 8061-velden en is geanonimiseerd (I11). Het bevat geen motivaties en geen herleidbare persoonsgegevens.

## 7. Identiteitscontract

De core ontvangt een ondertekend token met minimaal `iss, sub, aud, assurance_level, iat, exp` en gebruikt alleen `sub` als bieder-identiteit. De core verandert niet als de methode wijzigt van magic link naar iDIN. Het `assurance_level` legt de sterkte vast (I10).

## 8. Versionering en compatibiliteit

- Semver op protocol en implementatie. Breaking changes zijn een major versie.
- Oude logboeken moeten voor altijd verifieerbaar blijven. Formaten zijn geversioneerd, en een verifier ondersteunt oudere formaatversies.
- Een wijziging aan een invariant is per definitie breaking en vereist een expliciet besluit via het RFC-proces.

## 9. Dreigingsmodel

| Aanvaller | Wil | Wordt tegengehouden door |
|---|---|---|
| Oneerlijke operator of makelaar | Vroeg meekijken | I1, I4 (timelock, geen sleutel vóór deadline) |
| Oneerlijke operator | Bod invoegen, wijzigen of verwijderen | I2, I3, I5, I6, I8 |
| Oneerlijke operator | Achteraf het logboek herschrijven | I3, I8 (hashketen plus anchoring) |
| Kwaadwillende bieder | Ander bod onthullen dan gecommit | I2 |
| Kwaadwillende bieder | Beweren dat zijn bod ontbrak | I7 (ontvangstbewijs plus inclusiebewijs) |
| Instantie | Vals claimen dat zij conform en actueel is | Certificering, trust-list, anchoring |
| Netwerk of derde | Inhoud van biedingen onderscheppen | I1 (verzegeld bij de bieder) |
| Oneerlijke makelaar | Weten wie er biedt, en daarop sturen | I12 (envelop versleuteld naar de verkoper, niet naar de instantie) |
| Verkoper | Identiteiten inzien vóór gunning | Slechts deels: gelogde vrijgave maakt het zichtbaar, niet onmogelijk (zie §5a) |

Niet afgedekt zonder extra maatregelen: bewijzen dat een draaiende server exact de gemeten code uitvoert. Daarvoor is remote attestation nodig. Tot dan leunt het bewijs op certificering, anchoring en de ontvangstbewijzen van gebruikers.

## 10. Conformiteit

Een implementatie is conform als zij voor elke invariant I1 tot en met I12 de bijbehorende test in de conformance-suite haalt, en de NTA 8061-velden en verkoopmethoden ondersteunt. Falen op één invariant betekent niet conform.
