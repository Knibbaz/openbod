# Backlog: Open Transparant Bieden

Epics, stories en testcases. Format van een story: "Als [rol] wil ik [doel] zodat [reden]." Bij elke story staan acceptatiecriteria en testcases, inclusief negatieve en beveiligingsgevallen, want in een vertrouwenssysteem zijn juist die het belangrijkst.

Rollen: makelaar, verkoper, bieder, operator (draait een instantie), toetser (certificering), publiek (kan verifieren).

---

## E1. Woning en dossier

Het cosmetische en informatieve deel. Dit hoort niet in de trust-core. De antwoorden op de vragenlijst mogen wel in het logboek gehasht worden, zodat ook het dossier achteraf onwrikbaar is. Opmaak en afbeeldingen zijn puur presentatie en mogen de integriteit nooit raken.

### E1-S1 Woning toevoegen
Als makelaar wil ik een woning toevoegen met prijsvorm, deadline en verkoopmethode, zodat er een biedproces gestart kan worden.

Acceptatiecriteria:
- Verplichte velden: adres, prijsvorm (vraagprijs, richtprijs of bieden vanaf), verkoopmethode, sluitingsdatum en tijd.
- De regels worden vastgelegd: intrekken toegestaan, aanpassen toegestaan, aantal biedingen zichtbaar, wie inzage krijgt.

Testcases:
- TC1: geldige invoer maakt een listing aan met status "open".
- TC2: een sluitingsdatum in het verleden wordt geweigerd.
- TC3: een ontbrekende verkoopmethode wordt geweigerd.

### E1-S2 Vragenlijst online laten invullen
Als makelaar wil ik de verkoper een online link sturen om de vragenlijst en de lijst van zaken in te vullen, zodat het dossier compleet en controleerbaar is.

Acceptatiecriteria:
- De verkoper krijgt een unieke, verlopende link.
- Ingevulde antwoorden worden opgeslagen en een hash ervan gaat in het logboek.
- De lijst van zaken levert de overname-items die bieders later zien.

Testcases:
- TC1: verkoper vult in en indient, de antwoorden verschijnen in het dossier.
- TC2: een verlopen of hergebruikte link wordt geweigerd.
- TC3: wijziging van een antwoord na indienen levert een nieuwe versie plus een nieuwe logregel op.

### E1-S3 White-label opmaak en afbeeldingen
Als makelaar wil ik stijl, opmaak en eigen afbeeldingen kiezen voor de webpagina en de PDF, zodat het bij mijn huisstijl past.

Acceptatiecriteria:
- Kleuren, logo, lettertype en afbeeldingen zijn instelbaar per makelaar of per woning.
- De PDF en de webpagina gebruiken diezelfde instellingen.
- Opmaakinstellingen zitten in de presentatielaag en beinvloeden geen enkele hash of biedgegeven.

Testcases:
- TC1: een gewijzigde huisstijl verschijnt op de webpagina en in de PDF.
- TC2: een integriteitscheck van het logboek blijft identiek voor en na een opmaakwijziging.

## E2. Verzegeld bieden (commit)

### E2-S1 Een verzegeld bod plaatsen
Als bieder wil ik mijn bod versleuteld indienen, zodat niemand het vóór de deadline kan lezen.

Acceptatiecriteria:
- De client berekent een commitment en versleutelt het bod met een timelock naar de deadline-ronde.
- De core ontvangt alleen commitment en ciphertext, nooit de leesbare inhoud.
- De bieder krijgt een ondertekend ontvangstbewijs met logindex en entryHash.

Testcases:
- TC1: na indienen bevat de opslag alleen ciphertext en commitment, geen leesbaar bedrag.
- TC2 (beveiliging): een verzoek dat leesbaar plaintext meestuurt, wordt geweigerd.
- TC3: het ontvangstbewijs verifieert tegen de op dat moment laatste logregel.

### E2-S2 Voorbehouden, motivatie en overname in het bod
Als bieder wil ik voorbehouden, een motivatie en overname-keuzes meesturen, zodat mijn hele pakket in één keer verzegeld is.

Acceptatiecriteria:
- Ondersteunde voorbehouden: financieel (met datum), bouwdepot, bouwkundige keuring, verkoop eigen woning, NHG, anders.
- Overname per item: geen, gevraagd bedrag, eigen bod, in overleg, optioneel onder voorbehoud.
- Motivatie is vrije tekst en zit in de versleutelde payload.

Testcases:
- TC1: alle onderdelen zitten na onthulling in het onthulde bod.
- TC2: een financieel voorbehoud zonder datum wordt geweigerd of gemarkeerd.
- TC3 (privacy): de motivatie komt niet in het openbare logboek terecht.

## E3. Onthulling (reveal)

### E3-S1 Automatische onthulling op de deadline
Als verkoper wil ik dat alle biedingen op de deadline vanzelf opengaan, zodat niemand hoeft te wachten op bieders.

Acceptatiecriteria:
- Op de deadline komt de drand-rondesleutel beschikbaar en worden de biedingen ontsleuteld.
- Er is geen actie van bieders nodig.

Testcases:
- TC1: na de deadline zijn alle geldige biedingen zichtbaar voor de verkoper.
- TC2 (beveiliging): een poging tot ontsleutelen vóór de deadline mislukt, want de sleutel bestaat nog niet.
- TC3: een offline bieder hoeft niets te doen en zijn bod wordt gewoon onthuld.

### E3-S2 Validatie tegen de commitment
Als publiek wil ik dat elk onthuld bod tegen zijn commitment wordt gecheckt, zodat niemand achteraf een ander bod kan invoegen.

Acceptatiecriteria:
- Voor elk bod geldt H(plaintext plus salt) is gelijk aan de opgeslagen commitment.
- Een mismatch markeert het bod als ongeldig en logt dat.

Testcases:
- TC1: een correct bod valideert.
- TC2 (beveiliging): een gemanipuleerde ciphertext of plaintext faalt de validatie en wordt ongeldig gemarkeerd.

## E4. Onwrikbaar logboek

### E4-S1 Hashketen
Als publiek wil ik dat elke gebeurtenis in een hashketen staat, zodat wijzigen, invoegen of verwijderen zichtbaar wordt.

Acceptatiecriteria:
- Elke logregel bevat prevHash en een berekende entryHash.
- Een verificatiefunctie herrekent de keten.

Testcases:
- TC1: verify slaagt op een intacte log.
- TC2 (beveiliging): het wijzigen van één regel laat verify falen vanaf die regel.
- TC3 (beveiliging): het verwijderen van een regel laat verify falen.

### E4-S2 Verankering
Als toetser wil ik dat elke instantie root-hashes publiceert naar de gedeelde transparency-log, zodat herschrijven achteraf onmogelijk is.

Acceptatiecriteria:
- De instantie anchort periodiek de laatste entryHash.
- Er komen geen persoonsgegevens in de transparency-log, alleen hashes.

Testcases:
- TC1: na anchoring is de root terug te vinden in de publieke log.
- TC2 (beveiliging): een logboek dat niet matcht met de geanchorde root wordt bij verificatie afgekeurd.

### E4-S3 Automatisch biedlogboek versturen
Als bieder en verkoper wil ik het volledige logboek automatisch ontvangen na afronding, zodat ik het niet hoef op te vragen.

Acceptatiecriteria:
- Bij het onherroepelijk worden gaat het logboek naar alle betrokkenen.
- Het logboek bevat de NTA 8061-velden.

Testcases:
- TC1: alle bieders en de verkoper ontvangen het logboek zonder erom te vragen.
- TC2: het openbare logboek is geanonimiseerd.

## E5. Identiteit

### E5-S1 Login via magic link
Als bieder wil ik inloggen via een e-maillink, zodat ik zonder wachtwoord kan bieden in de demo.

Acceptatiecriteria:
- De identity-backend geeft een OIDC-token met een pseudonieme sub op niveau email.
- De core verifieert het token en gebruikt alleen sub.

Testcases:
- TC1: een geldige magic link levert een sessie en een token op.
- TC2 (beveiliging): een verlopen of hergebruikte link wordt geweigerd.

### E5-S2 Pluggable identiteit
Als operator wil ik later iDIN toevoegen zonder de core te wijzigen, zodat de biedlogica identiek blijft.

Acceptatiecriteria:
- Het identiteitscontract is stabiel: iss, sub, aud, assurance_level, iat, exp.
- Een nieuwe methode verhoogt alleen het assurance_level.

Testcases:
- TC1: de core accepteert tokens van meerdere methoden zonder codewijziging.
- TC2 (beveiliging): een token met verkeerde aud of ongeldige handtekening wordt geweigerd.

## E6. Regels en zichtbaarheid

### E6-S1 Intrekken of aanpassen vóór de deadline
Als bieder wil ik mijn bod vóór de deadline kunnen intrekken of aanpassen als de regels dat toestaan, zodat ik kan reageren op nieuwe informatie.

Acceptatiecriteria:
- Intrekken en aanpassen zijn per woning aan of uit.
- Elke actie levert een nieuwe logregel op, de oude versie blijft in de historie.

Testcases:
- TC1: bij toegestaan aanpassen ontstaat een nieuwe verzegelde versie en een logregel.
- TC2 (beveiliging): bij niet toegestaan intrekken wordt de poging geweigerd en gelogd.
- TC3 (beveiliging): aanpassen na de deadline wordt geweigerd.

### E6-S2 Zichtbaarheid van het aantal biedingen
Als bieder wil ik zien hoeveel biedingen er al zijn als de verkoper dat toestaat, zodat ik meer inzicht heb zonder de bedragen te kennen.

Acceptatiecriteria:
- Alleen het aantal is zichtbaar, nooit bedragen, als de instelling aan staat.

Testcases:
- TC1: met de instelling aan toont de pagina een correct aantal.
- TC2 (beveiliging): met de instelling uit is het aantal niet opvraagbaar via de API.

## E7. Gunning en afronding

### E7-S1 Biedingen bekijken en gunnen
Als verkoper wil ik na de deadline alle biedingen compleet naast elkaar zien en gunnen, zodat ik een geinformeerde keuze maak.

Acceptatiecriteria:
- Per bod: bedrag, voorbehouden, overname, motivatie, zekerheidssignaal.
- De verkoper kan gunnen of een nieuwe ronde starten.

Testcases:
- TC1: de verkoper ziet het volledige pakket per bieder.
- TC2: gunnen legt de keuze vast in het logboek.

## E8. Verificatie voor gebruikers

### E8-S1 Zelf een bod en logboek verifieren
Als bieder wil ik met een los hulpmiddel mijn ontvangstbewijs en het logboek verifieren, zodat ik niet op de operator hoef te vertrouwen.

Acceptatiecriteria:
- De verifier controleert de hashketen, de timelock-onthulling en de aanwezigheid van het eigen bod.
- De verifier werkt zonder toegang tot de instantie, op basis van het openbare logboek en de anchor.

Testcases:
- TC1: een geldig logboek plus ontvangstbewijs verifieert.
- TC2 (beveiliging): een gemanipuleerd logboek faalt de verifier, met aanwijzing van de eerste kapotte regel.

## E9. Federatie en conformiteit

### E9-S1 Conformance-suite
Als toetser wil ik een implementatie tegen de eisen kunnen draaien, zodat conformiteit aantoonbaar is.

Acceptatiecriteria:
- De suite dekt de kerngaranties en de NTA 8061-velden.
- Slagen of falen is machinaal leesbaar.

Testcases:
- TC1: de referentie-implementatie slaagt voor de volledige suite.
- TC2: een instantie die vroeg kan ontsleutelen zakt voor de suite.

### E9-S2 Certificaat en trust-list
Als publiek wil ik kunnen controleren of een instantie een geldig certificaat heeft, zodat een conform-claim niet zelf verklaard is.

Acceptatiecriteria:
- Een toetsende partij ondertekent de publieke sleutel van een geslaagde instantie.
- Certificaten zijn intrekbaar en staan op een controleerbare lijst.

Testcases:
- TC1: een instantie met geldig, niet-ingetrokken certificaat wordt als conform herkend.
- TC2 (beveiliging): een ingetrokken of ontbrekend certificaat wordt afgewezen.

## E10. Presentatie en white-label

### E10-S1 Zelf te hosten, herbruikbare frontend
Als operator wil ik de referentie-frontend zelf hosten en reskinnen, zodat ik een eigen product kan aanbieden bovenop de gedeelde core.

Acceptatiecriteria:
- De frontend is een losse client tegen de core-API.
- Thema en teksten zijn instelbaar zonder de core te wijzigen.

Testcases:
- TC1: een tweede, anders gethematiseerde frontend werkt tegen dezelfde core.
- TC2 (beveiliging): de frontend kan geen endpoints aanroepen die bedragen vóór de deadline zouden tonen, want die bestaan niet.

---

## Prioritering voor de demo (MVP)

Minimale set om het verhaal te tonen en een subsidieaanvraag te onderbouwen: E1-S1, E1-S2, E2-S1, E2-S2, E3-S1, E3-S2, E4-S1, E4-S3, E5-S1, E6-S2, E7-S1, E8-S1.

Later: E1-S3, E4-S2, E5-S2, E6-S1, E9, E10.

## Testsoorten

- Property-based tests op de invarianten in E2, E3 en E4. Dit zijn de belangrijkste.
- Integratietests op de API-contracten in E1, E2, E5, E7.
- Verificatietests met de losse verifier in E8, zodat de gebruiker echt onafhankelijk kan controleren.
- Negatieve en beveiligingstests overal waar "beveiliging" staat, want die bewijzen dat vals spelen faalt.
