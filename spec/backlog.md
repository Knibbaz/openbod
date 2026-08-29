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

### E1-S4 Woninggegevens importeren uit open bronnen
Als makelaar wil ik een adres kunnen opzoeken en de kenmerken automatisch ingevuld krijgen, zodat ik een woning in een minuut klaarzet in plaats van elk veld over te typen.

Bron is bewust niet Funda maar open overheidsdata: de PDOK-locatieserver voor adressen, de BAG van het Kadaster voor bouwjaar, oppervlakte en gebruiksdoel, en EP-Online bij de RVO voor het energielabel. Die gegevens zijn vrij te gebruiken en door iedereen na te trekken, wat precies past bij een systeem dat niet op vertrouwen leunt. Vraagprijs, foto's en omschrijving blijven handwerk van de makelaar, want die zijn van hem.

Uit te zoeken voordat dit gebouwd wordt: welke van deze bronnen zonder aangevraagde sleutel te gebruiken zijn. PDOK is vrij; over de BAG-bevraging en EP-Online moet dat nagekeken worden, en een sleutel hoort dan in de core te staan en niet in de browser.

Acceptatiecriteria:
- Een adres zoeken vult adres en kenmerken in het formulier, zonder ze vast te zetten: de makelaar kan alles corrigeren.
- De herkomst van de ingevulde gegevens staat bij het veld, zodat niemand denkt dat het systeem het verzonnen heeft.

Testcases:
- TC1: een bestaand adres levert kenmerken die overeenkomen met de bron.
- TC2: een onbekend adres of een bron die niet antwoordt, blokkeert het handmatig invullen niet.

### E1-S5 Aanbod importeren dat de makelaar zelf mag aanleveren
Als makelaar wil ik mijn bestaande aanbod importeren uit mijn eigen systeem, zodat ik niet dubbel werk doe om mee te draaien.

De juiste route is een bestand of koppeling die de makelaar zelf aanlevert, want het is zijn eigen aanbod: een export uit zijn CRM, of een feed van zijn eigen website. Funda scrapen is geen route. Funda heeft geen open API voor derden; er is een Partner API (`partnerapi.funda.nl/feeds/Aanbod.svc/[key]/`) waarvoor Funda een sleutel uitgeeft en waarvan de documentatie niet publiek is, plus een XML-koppeling waarmee makelaars hun aanbod juist naar Funda sturen. Een makelaar die zijn eigen sleutel invult zou dus kunnen werken, mits de voorwaarden van Funda dat toestaan, en dat is een vraag aan Funda en niet aan de code. Zonder sleutel resteert scrapen, en dat botst met hun voorwaarden, met het databankenrecht en met het auteursrecht op foto's en teksten van de makelaar of de fotograaf.

Dit loont pas als er een makelaar aan tafel zit die het echt wil gebruiken.

Acceptatiecriteria:
- Import via een aangeleverd bestand in een gedocumenteerd formaat werkt zonder dat de core partij-specifieke koppelingen kent.
- Een geimporteerde woning is niet te onderscheiden van een handmatig aangemaakte, dossierhash inbegrepen.

Testcases:
- TC1: een importbestand levert woningen die de conformance-suite haalt.
- TC2: een importbestand met ontbrekende verplichte velden faalt met een aanwijsbare regel, niet met een half aangemaakte woning.

## E2. Verzegeld bieden (commit)

### E2-S0 Lekcheck over de volledige toestand
Als toetser wil ik kunnen aantonen dat een waarde nergens in de instantie staat, zodat "de operator kan niet meekijken" een controleerbare eigenschap is in plaats van een belofte.

Acceptatiecriteria:
- Een test dumpt de complete objectgraaf van de store, inclusief Maps en interne velden, en zoekt daarin naar de echte waarden.
- Vóór de deadline komen bedrag, motivatie, naam en contact nergens voor.
- Na de onthulling hoort het bedrag er wél te staan; naam en contact nog steeds niet.
- Ook na gunning zijn naam en contact afwezig: de envelop gaat de deur uit zonder geopend te zijn.
- De test bewijst zichzelf door aan te tonen dat de dump de commitment wél vindt, dus dat afwezigheid geen onbereikbaarheid is.

Testcases:
- TC1: dump vóór de deadline bevat geen enkele plaintextwaarde.
- TC2: dump na de onthulling bevat het bedrag, maar geen identiteit.
- TC3: dump na gunning bevat nog steeds geen identiteit.
- TC4: het openbare logboek bevat het bedrag en geen motivatie.
- TC5: een ingetrokken bod blijft onleesbaar en blijft zichtbaar in de keten (I6).

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
- Bij het bereiken van een eindstatus (onherroepelijk of buiten_procedure) gaat het logboek naar alle betrokkenen, inclusief bieders die hun bod hadden ingetrokken.
- Het logboek bevat de NTA 8061-velden.
- De verzending is zelf een logregel (`logboek_verstuurd`) met alleen pseudonieme ontvangers.
- Verzending is idempotent; een mislukte poging levert geen logregel op en wordt opnieuw geprobeerd.
- De core kent geen e-mailadressen: zij stuurt pseudonieme subjects naar de identiteitslaag, die als enige de koppeling heeft.

Testcases:
- TC1: alle bieders en de verkoper ontvangen het logboek zonder erom te vragen.
- TC2: het openbare logboek is geanonimiseerd.
- TC3: herhaald en gelijktijdig aanroepen levert precies een `logboek_verstuurd`-regel op.
- TC4 (beveiliging): een mislukte bezorging claimt geen verzending in de keten.
- TC5 (beveiliging): er wordt niets verstuurd zolang de procedure nog loopt.

## E5. Identiteit

### E5-S1 Login via magic link
Als bieder wil ik inloggen via een e-maillink, zodat ik zonder wachtwoord kan bieden in de demo.

Acceptatiecriteria:
- De identity-backend geeft een OIDC-token met een pseudonieme sub op niveau email.
- De core verifieert het token en gebruikt alleen sub.
- De sub is `HMAC-SHA256(pepper, genormaliseerd adres)`, niet een kale hash van het adres. Een e-mailadres heeft te weinig entropie voor `sha256(adres)`: met een lijst kandidaat-adressen is zo'n hash gewoon terug te rekenen, en dan is "de core kent geen e-mailadressen" een bewering over opslag in plaats van over afleidbaarheid.
- Zonder pepper start de backend in productie niet op.

Testcases:
- TC1: een geldige magic link levert een sessie en een token op.
- TC2 (beveiliging): een verlopen of hergebruikte link wordt geweigerd.
- TC3 (beveiliging): een sub is niet te raden uit het adres zonder de pepper, ook niet met een woordenlijst van gebruikelijke varianten.
- TC4 (beveiliging): een ontbrekende pepper in productie en een te korte pepper worden geweigerd.

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

### E6-S3 Het logboek meelezen tijdens de biedfase
Als bieder wil ik tijdens de inschrijving de logboekregels kunnen zien, zodat een makelaar mij niet aan de telefoon kan vertellen dat er nog vier hogere biedingen liggen.

Dit is de zichtbaarheid uit E6-S2 doorgetrokken van een telling naar de regels zelf: tijdstip, pseudoniem en wat er gebeurde (bod geplaatst, aangepast, ingetrokken). Bedragen blijven eruit, want die zijn tot de sluitingstijd voor niemand leesbaar, ook niet voor de instantie. Het richt zich op de klacht uit het VEH-meldpunt dat kopers tegen elkaar worden uitgespeeld met biedingen waarvan later niet blijkt of ze bestonden.

De keerzijde hoort in de afweging: biedritme is ook informatie. Wie ziet dat er in het laatste uur drie biedingen bijkomen, leidt daaruit af dat het druk is. Daarom instelbaar per woning, net als E6-S2, en niet standaard aan.

Acceptatiecriteria:
- Met de instelling aan tonen de regels tijdstip, type en pseudoniem, nooit bedragen of identiteiten.
- De getoonde regels komen uit dezelfde hashketen als het eindlogboek en zijn dus achteraf narekenbaar.

Testcases:
- TC1: een bieder ziet dezelfde regels terug in het eindlogboek, op dezelfde plek in de keten.
- TC2 (beveiliging): met de instelling uit levert het endpoint niets, ook niet voor een ingelogde bieder.

## E7. Gunning en afronding

### E7-S1 Biedingen bekijken en gunnen
Als verkoper wil ik na de deadline alle biedingen compleet naast elkaar zien en gunnen, zodat ik een geinformeerde keuze maak.

Acceptatiecriteria:
- Per bod: bedrag, voorbehouden, overname, motivatie, zekerheidssignaal.
- De verkoper kan gunnen of een nieuwe ronde starten.

Testcases:
- TC1: de verkoper ziet het volledige pakket per bieder.
- TC2: gunnen legt de keuze vast in het logboek.

### E7-S2 Afhandeling buiten de procedure om
Als bieder wil ik dat een verkoop die buiten dit biedproces om wordt afgehandeld een vastgelegde eindstatus met reden krijgt, zodat een inschrijving niet zonder uitleg kan stilvallen.

Dit is een van de klachten uit het meldpunt van Vereniging Eigen Huis: een gesloten inschrijving waarbij de woning toch buiten de procedure om wordt verkocht. Het systeem kan zo'n verkoop niet verhinderen, maar het kan wel afdwingen dat er iets controleerbaars van overblijft.

Acceptatiecriteria:
- De overgang naar status `buiten_procedure` vereist een opgegeven reden, die onverkort in het openbare logboek komt.
- De gebeurtenis wordt gelogd als `buiten_procedure_afgehandeld`.
- Nog niet onthulde biedingen blijven verzegeld en worden niet alsnog geopend.
- Het logboek gaat daarna automatisch naar alle bieders (E4-S3).

Testcases:
- TC1: afbreken levert status `buiten_procedure`, een logregel en een logboek met de reden op.
- TC2: bieders krijgen het logboek, ook zonder gunning.
- TC3: niet onthulde biedingen staan als `bid_placed` in de keten en niet als `bid_revealed`.
- TC4 (beveiliging): een lege reden wordt geweigerd.
- TC5 (beveiliging): na afbreken wordt een nieuw bod geweigerd.
- TC6 (beveiliging): een reeds gegunde procedure kan niet alsnog als buiten de procedure worden weggeschreven.

## E8. Verificatie voor gebruikers

### E8-S1 Zelf een bod en logboek verifieren
Als bieder wil ik met een los hulpmiddel mijn ontvangstbewijs en het logboek verifieren, zodat ik niet op de operator hoef te vertrouwen.

Acceptatiecriteria:
- De verifier controleert de hashketen, de timelock-onthulling en de aanwezigheid van het eigen bod.
- De verifier werkt zonder toegang tot de instantie, op basis van het openbare logboek en de anchor.

Testcases:
- TC1: een geldig logboek plus ontvangstbewijs verifieert.
- TC2 (beveiliging): een gemanipuleerd logboek faalt de verifier, met aanwijzing van de eerste kapotte regel.

### E8-S2 Demoscenario dat de garanties laat zien
Als bezoeker wil ik een uitgespeeld scenario zien waarin per stap staat wat elke partij op dat moment kan zien, zodat ik de garanties begrijp zonder de code te lezen.

**Status: nog niet gebouwd, en het heeft echt werk nodig.** De onderliggende bewijzen bestaan wel (zie de lekcheck in `packages/core/test/invariants/geen-lek.test.ts` en de subject-tests in `packages/identity/test/subject.test.ts`), maar er is nog geen scenario dat ze aan een bezoeker toont.

Het lastige zit niet in het script maar in de eis eronder: de tekst moet uit de echte toestand komen, niet uit proza. Een geschreven rondleiding ("Alice biedt nu 510.000") bewijst niets, want die tekst klopt ook als het systeem liegt. Wat overtuigt, is een dump van wat de instantie op dat moment werkelijk in handen heeft, met de echte waarden als zoekterm en nul treffers. Dat vraagt om een vorm waarin de uitvoer gegenereerd wordt en de uitleg eromheen geschreven, zonder dat die twee uit elkaar kunnen lopen.

Openstaande vragen voordat dit gebouwd kan worden:
- Draait het scenario tegen een echte instantie (traag, want drand-rondes van 3s, maar eerlijk) of tegen vastgelegde uitvoer (snel, maar dan moet aantoonbaar zijn dat die uitvoer echt is)?
- Hoe voorkom je dat de uitlegtekst na een codewijziging stilletjes niet meer klopt bij de uitvoer?
- Hoort dit in de frontend, in een CLI, of allebei met dezelfde bron?

Acceptatiecriteria (concept):
- Per stap is zichtbaar wat identity weet, wat de core weet en wat de verkoper kan openen.
- De getoonde uitvoer is gegenereerd uit een echte doorloop, niet met de hand geschreven.
- Een poging tot vroeg ontsleutelen en een poging tot openen van de identiteitsenvelop staan er zichtbaar als mislukt in.
- De lekcheck over de volledige toestand hoort bij de uitvoer.

## E11. Open bieden als tweede verkoopmethode

### E11-S1 Openbaar bieden naar Noors voorbeeld
Als verkoper wil ik kunnen kiezen voor openbaar bieden, waarbij het hoogste actuele bod voor iedereen zichtbaar is, zodat kopers niet blind hoeven te overbieden.

Het protocol kan dit aan zonder zijn kern op te geven: `verkoopmethode` is al een veld, en bij open bieden vervalt alleen de timelock. De hashketen, de pseudoniemen, het narekenbare logboek en de automatische verstrekking blijven staan, en zijn hier harder nodig dan bij verzegeld bieden, want bij open bieden moet aantoonbaar zijn dat een getoond bod echt van een echte bieder kwam.

Openstaande vragen voordat dit gebouwd kan worden:
- Een bod van een consument is in Nederland niet bindend tot de akte getekend is, met daarna drie dagen bedenktijd. In Noorwegen is open bieden wettelijk ingebed met bindende biedingen en korte acceptatietermijnen. Zonder die binding kan een bod de prijs opdrijven en daarna verdwijnen, precies het nepbod dat verzegeld bieden onmogelijk maakt. Welke maatregel vervangt die binding hier?
- Wat doet open bieden met de prijs in een markt met tekort? Dat is de eerste vraag die een kritische lezer bij het ministerie stelt, en het antwoord hoort onderbouwd te zijn en niet aangenomen.
- Blijven de invarianten I1 tot en met I15 gelden, of krijgt open bieden een eigen set die aantoonbaar even sterk is op de punten die overblijven?

Acceptatiecriteria (concept):
- Verzegeld en open bieden draaien op dezelfde core, met dezelfde keten en hetzelfde logboek.
- Bij open bieden is per bod aantoonbaar dat het van een geverifieerde bieder kwam en wanneer het binnenkwam.

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

Minimale set om het verhaal te tonen en een subsidieaanvraag te onderbouwen: E1-S1, E1-S2, E2-S1, E2-S2, E3-S1, E3-S2, E4-S1, E4-S3, E5-S1, E6-S2, E7-S1, E7-S2, E8-S1.

Later: E1-S3, E1-S4, E1-S5, E4-S2, E5-S2, E6-S1, E6-S3, E8-S2, E9, E10, E11.

## Testsoorten

- Property-based tests op de invarianten in E2, E3 en E4. Dit zijn de belangrijkste.
- Integratietests op de API-contracten in E1, E2, E5, E7.
- Verificatietests met de losse verifier in E8, zodat de gebruiker echt onafhankelijk kan controleren.
- Negatieve en beveiligingstests overal waar "beveiliging" staat, want die bewijzen dat vals spelen faalt.
