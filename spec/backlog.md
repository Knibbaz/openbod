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

**Status: gebouwd voor adres, woonoppervlak en bouwjaar.** Beide bronnen bleken zonder sleutel of registratie te werken: de locatieserver (`api.pdok.nl/bzk/locatieserver/search/v3_1`) voor het zoeken, en de BAG OGC API v2 (`api.pdok.nl/kadaster/bag/ogc/v2`) voor de gebruiksoppervlakte van het verblijfsobject en het bouwjaar van het pand. De opzoeking draait in de core (`packages/core/src/adres/pdok.ts`), niet in de browser: PDOK ziet dan de instantie in plaats van elke makelaar, de drie verzoeken die één opzoeking kost worden tot één antwoord samengevoegd, en de instantie kan begrenzen hoeveel verkeer zij naar een gratis publieke voorziening stuurt.

Nog open: het energielabel uit EP-Online (RVO), waarvoor wél een sleutel nodig is, en het perceeloppervlak, dat niet in de BAG zit maar in de kadastrale registratie en niet vrij beschikbaar is. Beide velden vult de makelaar voorlopig zelf.

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

### E7-S3 Bekendgemaakte voorkeur van de verkoper
Als bieder wil ik vooraf weten of de verkoper naast de prijs nog iets anders laat meewegen, zodat ik niet achteraf hoor dat er op gronden gekozen is die ik niet kende.

Verkopers hebben vaak een voorkeur die niet over geld gaat. Een woning waar iemand 35 jaar woonde, gaat liever naar een startend gezin uit het dorp dan naar een belegger. Die voorkeur bestaat nu ook al, maar zij loopt langs de telefoon van de makelaar en is voor niemand controleerbaar. Dat is dezelfde soort onzichtbaarheid als een bod dat na de deadline wordt ingevoerd.

Het systeem hoeft niet te beslissen of zo'n voorkeur mag. Het moet afdwingen dat zij vooraf op tafel ligt en achteraf vastligt. Een bekendgemaakte voorkeur is aanvechtbaar; een verzwegen voorkeur is dat niet.

Twee ontwerpkeuzes die vastliggen en niet ter discussie staan:

- **Geen toegangspoort.** De voorkeur mag nooit bepalen wie mág bieden. Een selectie vooraf geeft de makelaar precies het discretionaire moment terug dat dit project afschaft: "uw motivatie was niet sterk genoeg" is niet te weerleggen. Iedereen biedt; de voorkeur weegt pas bij de gunning.
- **Geen filter in de software.** De instantie rangschikt niet op voorkeur en berekent geen score. Zij publiceert de tekst en legt de keuze vast. Zodra de software gaat selecteren, wordt zij het instrument en niet de administratie.

Openstaande vraag voordat dit gebouwd wordt: waar loopt de grens met gelijke behandeling? "Starter" en "uit de gemeente" staan niet in de opsomming van de Algemene wet gelijke behandeling, en de leeftijdswet (WGBL) gaat over arbeid en beroepsonderwijs, niet over het aanbieden van een woning. Maar een makelaar handelt in de uitoefening van beroep, en een criterium dat op zichzelf neutraal is kan in een homogene gemeente feitelijk op afkomst selecteren. Dat is indirect onderscheid, en dat is verboden tenzij objectief gerechtvaardigd. Dit hoort door een jurist bekeken te zijn voordat het in een instantie met echte woningen komt; het is niet aan de implementatie om dat te beslissen.

Acceptatiecriteria:
- De verkoper kan bij het aanmaken een korte, vrije tekst opgeven met wat er naast de prijs meeweegt.
- Die tekst staat zichtbaar bij de woning en gaat mee in de `dossierHash`, dus zij kan niet achteraf worden verzonnen of bijgesteld.
- De tekst staat ook in het openbare logboek.
- Ontbreekt de tekst, dan staat er expliciet dat er geen bekendgemaakte voorkeur is, in plaats van niets.
- Gunnen aan een ander dan het hoogste geldige bod blijft toegestaan en blijft in de keten staan als `gegund`.

Testcases:
- TC1: een woning met voorkeurstekst toont die tekst en neemt hem mee in de dossierhash.
- TC2: de voorkeurstekst wijzigen na het openen levert een andere dossierhash op en is dus aanwijsbaar.
- TC3: gunning aan het derde bod levert dezelfde logregel op als gunning aan het hoogste.
- TC4 (beveiliging): er is geen endpoint of veld waarmee een bieder op grond van de voorkeur geweerd kan worden.

### E7-S4 Pseudoniem profiel bij de onthulling
Als verkoper wil ik bij de onthulling zien wat voor koper er achter een bod zit, zodat ik meer kan afwegen dan alleen het bedrag, zonder dat ik van negen mensen de naam krijg die het huis niet kopen.

Een verkoper die 35 jaar in een huis woonde, wil weten of het naar een bewoner gaat of naar een belegger. Die vraag is legitiem, en zij loopt nu langs de makelaar en is voor niemand controleerbaar.

Het draait op het moment, en er is er maar een die kan:

- **Tijdens de biedfase: nooit.** Dan weet de verkoper, en dus de makelaar, wie er meedoet terwijl biedingen nog aangepast kunnen worden. Dat is precies de informatievoorsprong die dit project afschaft.
- **Bij de onthulling, voor de gunning: dit kan.** De inschrijving is dicht, alle biedingen liggen open, niets kan nog veranderen. Wat de verkoper dan ziet, kan geen enkel bod meer beinvloeden.

De anonimiteit hoeft dus te duren tot de inschrijving sluit, niet tot de gunning. Dat is een kleinere eis dan er nu staat en zij is verdedigbaar, mits het geen identiteit is.

Want dit is nadrukkelijk **geen identiteit**. Zag de verkoper bij de onthulling alle namen, dan hebben negen afgewezen bieders hun persoonsgegevens aan een vreemde gegeven voor niets. Dat is geen dataminimalisatie. Wat er wel komt is een handvol door de bieder zelf verklaarde kenmerken, verzegeld mee in het bod zoals de motivatie nu ook meegaat.

`eigen bewoning` is het belangrijkste kenmerk en het best te verdedigen: het is de vraag die verkopers echt stellen, het gaat over gedrag en niet over persoon, en er zit beleid achter (opkoopbescherming, zelfbewoningsplicht). De lijst kenmerken hoort kort en vast te liggen; een vrij veld wordt vanzelf een plek waar mensen hun achternaam invullen.

Openstaande vragen:
- Welke kenmerken precies? Voorstel om klein te beginnen: eigen bewoning ja/nee, financiering rond ja/nee/aangevraagd, en of de bieder eerst een woning moet verkopen. Alles wat verder gaat richting gezinssamenstelling of leeftijd hoort eerst langs een jurist, zie E7-S3.
- Zijn de kenmerken zelfverklaard en verder ongetoetst? Waarschijnlijk wel, en dan hoort er ook te staan dat het een verklaring is en geen bewijs.

Acceptatiecriteria:
- De kenmerken zitten verzegeld in het biedpakket en zijn voor de sluitingstijd voor niemand leesbaar, ook niet voor de instantie.
- De verkoper ziet ze na de onthulling, naast bedrag en motivatie.
- De kenmerken komen niet in het openbare logboek, net zomin als de motivatie.
- Bieders die niet gegund krijgen blijven anoniem: de identiteitsenvelop gaat alleen open bij gunning, ongewijzigd.
- Het scherm zegt bij de bieder dat dit een eigen verklaring is die de verkoper na de sluitingstijd leest.

Testcases:
- TC1: de kenmerken zijn voor de deadline nergens opvraagbaar (uitbreiding van de lekcheck E2-S0).
- TC2: na de onthulling ziet de verkoper de kenmerken per bod.
- TC3 (privacy): het openbare logboek bevat de kenmerken niet.
- TC4 (privacy): van een niet-gegunde bieder is geen naam of contactgegeven leesbaar, ook niet voor de verkoper.

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

### E8-S3 Bewijs op papier (gebouwd)
Als bieder of verkoper wil ik mijn ontvangstbewijs en het biedlogboek kunnen printen, met uitleg erbij, zodat ik het kan bewaren en aan iemand anders kan laten zien.

Een derde van de verkopers is 65-plus, en de kopers van die woningen zijn bovengemiddeld vaak zelf ook 65-plus (Kadaster, voorjaar 2026). Voor die groep is een JSON-bestand geen bewijsstuk maar een raadsel. De JSON blijft nodig voor de verifier; het papier is er voor de mens en voor de dochter, adviseur of notaris die het namens hem naloopt.

Acceptatiecriteria:
- Ontvangstbewijs en logboek zijn beide te printen of als pdf op te slaan, naast de bestaande JSON-download.
- Op beide staat in gewone taal: wat er bewaard is, hoe het versleuteld werd, wanneer en door wie het ontsleuteld wordt, en hoe iemand het kan narekenen.
- De verwijzing naar het verificatiegereedschap staat erbij, met de opmerking dat het van niemand in het proces is.
- Geen pdf-bibliotheek in de bundel: de browser drukt af.
- Alle ingevoegde waarden zijn ge-escaped, want adres en reden zijn vrije tekst.

Testcases:
- TC1: een ontvangstbewijs bevat bidId, commitment, logIndex, prevHash, entryHash, tijdstip, handtekening en de dossierhash.
- TC2: een logboek bevat de biedingen, de gebeurtenissen op volgorde, de slotcode en de handtekening.
- TC3 (beveiliging): een adres met HTML erin komt als tekst op papier en niet als opmaak.

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

## E12. Vertegenwoordiging en sleutelbeheer

Deze epic komt voort uit één cijfer. Bij ruim één op de drie woningverkopen is de verkoper 65-plus, en dat is inclusief mensen die overlijden en een koophuis nalaten (Kadaster, voorjaar 2026; in Twenterand 34 procent). Het datamodel kent nu één verkoper, met één sleutel, in één browser. Dat klopt niet met wie er in deze markt daadwerkelijk verkoopt, en het is de blokkade voor een instantie met echte woningen.

### E12-S1 Sleutel per account, met een herstelpad dat de operator niet heeft
Als deelnemer wil ik een sleutel die bij mijn account hoort en die ik kan terugkrijgen op een nieuw apparaat, zodat een gewiste browser of een nieuwe laptop mij niet buitensluit.

Nu maakt de verkoper per woning een sleutelpaar dat in `localStorage` belandt. Kwijt is kwijt, en dan blijft de identiteit van de winnende bieder onleesbaar: de verkoper kan zijn eigen verkoop niet afronden. Voor een doelgroep waarvan een derde 65-plus is, is dat geen randgeval.

De eis die alles bepaalt: het herstelpad mag geen sleutel opleveren die de operator ook heeft. Dan is de versleuteling toneel. Alles wat de server kan uitrekenen, kan degene die de server beheert ook uitrekenen; hij heeft het proces, het geheugen en de schijf. Een geheim in de database dat de beheerder niet kent, bestaat niet. Wat wel werkt is een sleutel die door de gebruiker wordt gedragen.

Voorstel: één sleutelpaar per account, in de browser gemaakt. De private sleutel wordt versleuteld opgeslagen bij de instantie, met een sleutel die is afgeleid uit een herstelcode die de gebruiker eenmalig krijgt en zelf bewaart. Die code past op het printbare document uit E8-S3, wat voor deze doelgroep het juiste medium is.

Wat dit oplevert naast het herstel: dezelfde sleutel kan het concept uit E2 versleutelen, waardoor het bedrag van een voorbereid bod niet langer leesbaar is voor de beheerder.

Openstaande vragen:
- Wat gebeurt er als de herstelcode kwijt is? Bij een verkoper betekent dat een onleesbare identiteitsenvelop. Is een tweede weg acceptabel, en zo ja, welke, zonder dat de operator hem kan lopen?
- Hoeveel wrijving is aanvaardbaar bij het eerste gebruik, gemeten bij iemand van boven de 70?

Acceptatiecriteria:
- Het sleutelpaar wordt in de browser gemaakt; de private sleutel verlaat het apparaat alleen versleuteld.
- Met de herstelcode kan een gebruiker op een ander apparaat verder, ook nadat browsergegevens gewist zijn.
- De instantie kan de private sleutel niet ontsleutelen, ook niet met volledige toegang tot haar database.
- De herstelcode staat op het printbare document.

Testcases:
- TC1: sleutel maken, browsergegevens wissen, met de herstelcode verder in een andere browser.
- TC2 (beveiliging): met de volledige database-inhoud en zonder de herstelcode is de private sleutel niet te ontsleutelen.
- TC3: een verkoper kan na herstel de identiteitsenvelop van het gegunde bod alsnog openen.

### E12-S2 Gemachtigde en erfgenamen
Als erfgenaam of gemachtigde wil ik een woning kunnen verkopen zonder dat het systeem aanneemt dat de verkoper zelf achter het scherm zit, zodat een nalatenschap of een volmacht geen doodlopende weg is.

`Listing` kent nu één `sellerSub` en één `sellerPublicKey`. Bij drie kinderen die het huis van hun overleden moeder verkopen klopt dat niet, en bij een volmacht evenmin. En als de sleutel bij de overledene hoorde, kan niemand de identiteit van de winnende bieder meer lezen.

Dit is de ontwerpkeuze die je later niet meer terugdraait, want zij zit in het datamodel, in de gunning en in wat er in het logboek terechtkomt.

Openstaande vragen die eerst een antwoord nodig hebben:
- Meerdere `sellerSub`-waarden, of één verkoperspartij waar meerdere accounts aan hangen? Het tweede is eerlijker tegenover het logboek, want er is één verkopende partij, ook als er drie mensen tekenen.
- Mag de identiteitsenvelop naar meerdere publieke sleutels versleuteld worden, of hangt zij aan één partij-sleutel die de erfgenamen delen?
- Wie mag gunnen als er drie gemachtigden zijn? Eén, of allemaal? En wat legt het logboek daarvan vast: dát er namens de partij gegund is, of wie van hen op de knop drukte?
- Wat is het bewijs van vertegenwoordiging? Het systeem kan een volmacht of verklaring van erfrecht niet toetsen. Waarschijnlijk hoort het alleen vast te leggen dát er namens iemand gehandeld is, en dat controleerbaar te maken, net als bij `buiten_procedure`.

Acceptatiecriteria (concept, af te maken na bovenstaande vragen):
- Een woning kan een verkopende partij hebben met meer dan één gemachtigd account.
- Het biedlogboek gaat naar alle gemachtigden, niet alleen naar de eerste.
- Uit het logboek blijkt dat er namens een partij gegund is, zonder persoonsgegevens van de gemachtigden.
- Een woning waarvan de verkoper is overleden kan worden afgerond zonder dat diens sleutel nog bestaat.

Testcases:
- TC1: drie gemachtigden, één gunning, één logregel, drie ontvangers van het logboek.
- TC2 (beveiliging): een account dat geen gemachtigde is kan niet gunnen.

## E13. Toegankelijkheid voor een vergrijzende markt

De zwaarste technische eisen van dit systeem landen bij de bieder en de verkoper: verzegelen, versleutelen, bewijs bewaren, narekenen. Dat is architectonisch juist, want die last moet liggen waar niemand eraan kan zitten. Maar bij een derde van de transacties is die persoon 65-plus, aan beide kanten. Wat voor een ontwikkelaar een detail is, is daar het verschil tussen meedoen en afhaken.

### E13-S1 Verzegelen op een oud apparaat
Als bieder met een oude telefoon of laptop wil ik weten dat mijn bod verstuurd wordt en hoe lang dat duurt, zodat ik niet vlak voor de sluitingstijd naar een scherm zit te kijken dat niets doet.

`sealBid` haalt de drand-informatie op en versleutelt in de browser. Hoe lang dat duurt op een vijf jaar oud toestel is nooit gemeten. Als dat tien seconden is zonder zichtbare voortgang, haakt iemand af of drukt hij twee keer.

Acceptatiecriteria:
- De duur van `sealBid` is gemeten op ten minste één toestel van vijf jaar oud en één trage verbinding, en het resultaat staat vastgelegd.
- Tijdens het verzegelen toont het scherm voortgang en een verwachting, geen stilstaande knop.
- Twee keer indrukken levert nooit twee biedingen op.
- Bij een mislukte drand-aanroep krijgt de bieder een leesbare fout met wat hij nu moet doen, met de sluitingstijd erbij.

Testcases:
- TC1: de meting is gedaan en gedocumenteerd.
- TC2: dubbel indrukken tijdens het verzegelen levert één bod op.
- TC3: drand onbereikbaar levert een begrijpelijke melding, geen stilte.

### E13-S2 Geen verzending die van een open tabblad afhangt (besloten)
Als bieder wil ik nooit in de veronderstelling verkeren dat mijn bod vanzelf verstuurd wordt terwijl dat niet gebeurt.

Er was een functie die het bod op een gekozen tijdstip verstuurde vanuit het tabblad van de bieder. Die is verwijderd. Voor iemand die zijn laptop dichtklapt in de veronderstelling dat het om 16:00 goed komt, is dit geen gemak maar een val, en juist deze doelgroep sluit de laptop.

Waarom er geen serverzijdige versie voor in de plaats komt: dan zou de core het bod moeten verzegelen, en daarmee kent zij het bedrag vóór de sluitingstijd. Dat is precies de garantie die dit hele systeem draagt. De enige plek waar de core zelf verzegelt is het demoscenario, met een opmerking erbij dat een echte instantie dat nooit doet.

Wat ervoor in de plaats komt is het argument dat toch al klopte: nu versturen kost niets. Het bod is onleesbaar tot de sluitingstijd, ook voor de makelaar, en aanpassen mag daarna nog steeds.

Acceptatiecriteria:
- Er is geen functie die een bod op een later moment verstuurt, in de browser noch op de server.
- Het scherm legt uit dat nu versturen niets kost en dat aanpassen open blijft.

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

### E9-S3 Bieden zonder de frontend van de instantie
Als bieder wil ik mijn bod kunnen verzegelen en versturen met gereedschap dat niet van de instantie komt, zodat de operator niet in het pad zit waar mijn bedrag nog leesbaar is.

Dit is het grootste gat dat overblijft. Alle garanties gaan over wat de server niet kan zien, maar de server levert wel de JavaScript die het verzegelen doet. Een operator die code uitlevert welke het bedrag óók onversleuteld meestuurt, omzeilt alles, en geen ontvangstbewijs laat dat zien. Dubbel versleutelen helpt niet: de aanval zit vóór de eerste versleuteling.

Het antwoord voor de browser staat in E9-S5: niet de hele frontend certificeren, maar alleen de afgeschermde module waar het bedrag doorheen gaat. Een hash over de volledige bundel werkt namelijk niet, want elke makelaar past kleuren en teksten aan.

Deze story gaat over de tweede weg, die daarnaast blijft bestaan: de verzegellogica zit al in `@openbod/core` en wordt door de conformance-suite getest. Daar een CLI omheen die inlogt, verzegelt en indient, betekent dat een bieder de website helemaal kan overslaan. Voor wie het echt zeker wil weten is dat de sterkste optie, want er is dan geen enkele door de instantie geleverde code bij betrokken. Het is ook het goedkoopste dat je kunt bouwen, want het meeste bestaat al.

Acceptatiecriteria:
- Een bieder kan met de CLI een volledig bod plaatsen en zijn ontvangstbewijs opslaan, zonder een frontend te laden.
- De CLI gebruikt dezelfde `sealBid` als de referentie-implementatie.
- De CLI komt uit de repo en niet van de instantie, en dat staat er ook bij.

Testcases:
- TC1: een bod uit de CLI en een bod uit de browser leveren dezelfde soort logregel en een geldig ontvangstbewijs op.
- TC2: de CLI werkt tegen elke conforme instantie, niet alleen tegen de referentie-instantie.

### E9-S4 Erkende getuigen en de chain hash in het logboek
Als verifieerder wil ik uit het logboek zelf kunnen aflezen welk timelock-netwerk gebruikt is, zodat een instantie niet stilletjes een getuige kan kiezen die zij zelf beheert.

De hele garantie dat niemand vroeg kan meelezen leunt op drand: een netwerk van onafhankelijke organisaties dat met een drempelhandtekening elke drie seconden een ronde produceert. Niemand kan die handtekening alleen maken, en de ontsleutelsleutel van een bod is de handtekening van de ronde waarnaar versleuteld is. Daarom bestaat die sleutel voor de sluitingstijd niet.

Dat werkt alleen zolang de getuige niet van de instantie is. Nu zit quicknet vastgebakken via `mainnetClient()` in `timelock/timelock.ts`. Dat is veilig maar niet configureerbaar; zodra iemand het configureerbaar maakt voor een fork, kan een instantie naar een netwerk wijzen dat zij zelf draait, en dan kan zij wel vroeg ontsleutelen.

Er is bovendien een gat dat nu al bestaat. De gebruikte getuige staat wel in de ciphertext, in de tlock-header:

```
age-encryption.org/v1
-> tlock 31761576 52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba9460...
```

Rondenummer en chain hash. Maar de ciphertext staat niet in het openbare logboek, dus een buitenstaander kan het uit het logboek alleen niet nagaan.

Acceptatiecriteria:
- Het logboek vermeldt de chain hash en het rondenummer waarnaar versleuteld is.
- De verifier controleert dat die chain hash op de lijst van erkende getuigen staat.
- De lijst van erkende getuigen is onderdeel van de certificering (E9-S2) en publiek.
- Een instantie die een niet-erkende getuige gebruikt, zakt voor de conformance-suite.

Testcases:
- TC1: het logboek bevat chain hash en ronde, en die komen overeen met de tlock-header van de biedingen.
- TC2 (beveiliging): een logboek met een onbekende chain hash wordt door de verifier afgekeurd.

### E9-S5 Afgeschermde biedmodule, vrije vormgeving eromheen
Als bieder wil ik dat mijn bedrag alleen door gecertificeerde code wordt gezien, ook als de makelaar zijn eigen huisstijl draait, zodat de vormgeving en de garantie niet met elkaar in de weg zitten.

Dit lost het bezwaar op dat een gepubliceerde bundelhash in de praktijk nooit klopt: een makelaar wil juist kleuren, logo en teksten aanpassen (E1-S3, E10-S1). Een hash over de hele frontend is dan waardeloos, want elke instantie is anders.

De oplossing is dezelfde die de betaalwereld al gebruikt. Een webwinkel richt zijn afrekenpagina volledig naar eigen smaak in, maar het veld waar het pasnummer in gaat komt uit een afgeschermd onderdeel van de betaaldienst, en de winkel ziet dat nummer nooit. Zo hoort het hier ook: **niet de hele frontend certificeren, maar alleen het stukje waar het bedrag doorheen gaat.**

Concreet: het biedformulier plus de verzegellogica draaien in een afgeschermd onderdeel op een eigen origine, geladen vanaf het register (E9-S7). De pagina van de makelaar kan daar niet in kijken, want de browser staat dat over origines heen niet toe. De makelaar geeft kleuren en teksten als parameters mee en richt alles eromheen in zoals hij wil. Wat er terugkomt is de ciphertext, nooit het bedrag.

Wat dit wel en niet verplaatst: de partij die dat onderdeel serveert wordt vertrouwd om eerlijke code te leveren, net als de partij die releases ondertekent. Zij ziet de gegevens niet: het verzegelen gebeurt in de browser van de bieder en alleen de ciphertext verlaat die. Dat is dezelfde soort vertrouwensrelatie als bij een certificaatuitgever, en veel smaller dan iedere makelaar afzonderlijk vertrouwen.

Acceptatiecriteria:
- Het biedformulier en `sealBid` draaien in een afgeschermd onderdeel op een eigen origine.
- De omliggende pagina kan de invoervelden niet uitlezen.
- Vormgeving gaat als parameters naar binnen; de makelaar kan alles eromheen inrichten.
- Alleen commitment, ciphertext en identiteitsenvelop verlaten het onderdeel.
- Het artefact heeft een gepubliceerde, ondertekende hash die niet meebeweegt met de huisstijl.

Testcases:
- TC1: twee instanties met verschillende huisstijl laden hetzelfde artefact met dezelfde hash.
- TC2 (beveiliging): script in de omliggende pagina kan het bedrag niet lezen.
- TC3: bieden werkt onveranderd, met hetzelfde ontvangstbewijs als nu.

### E9-S6 Gedragscontrole van een draaiende instantie
Als toetser wil ik van buitenaf kunnen vaststellen dat een instantie zich houdt aan het protocol, zonder te hoeven weten welke code zij draait.

Een server kan zeggen dat hij versie 1.2.3 draait terwijl hij iets anders draait. Dat is niet oplosbaar met een versienummer, en de zware oplossing (reproduceerbare builds plus attestatie in beveiligde hardware) is voor later. De omkering is goedkoper en sterker: **je hoeft de code niet te controleren als de uitvoer narekenbaar is.** Zo werkt Certificate Transparency ook: niemand controleert de software van een certificaatuitgever, maar hun uitvoer moet append-only en consistent zijn, en dat is wel te controleren.

Vier controles die van buitenaf werken:

1. **Anchoring** (E4-S2). Root-hashes in een publieke log. Wie de keten herschrijft, wijkt af van wat er geanchord staat.
2. **Ontvangstbewijzen.** Elke bieder houdt een ondertekende regel vast. Een bewaard bewijs dat niet meer klopt, ontmaskert een herschreven keten.
3. **Een proefbod.** Het register plaatst periodiek zelf een bod op elke gecertificeerde instantie en controleert het ontvangstbewijs, de keten en de anchor. Dat geeft een actueel signaal in plaats van een certificaat van vorig jaar.
4. **Wat wiskundig afgedwongen is.** De timelock werkt ongeacht welke code eronder draait: de sleutel bestaat nog niet.

Acceptatiecriteria:
- De conformance-suite kan tegen een draaiende instantie op afstand, niet alleen tegen een lokale build.
- Een proefbod levert een ontvangstbewijs op dat tegen de gepubliceerde sleutel van de instantie verifieert.
- Het resultaat per instantie is machinaal leesbaar en gaat naar het register.
- Een instantie die niet anchort, valt op zonder dat iemand haar code hoeft te zien.

Testcases:
- TC1: de suite draait op afstand tegen de referentie-instantie en slaagt.
- TC2 (beveiliging): een instantie die vroeg kan ontsleutelen, zakt.
- TC3 (beveiliging): een instantie die haar keten na een proefbod herschrijft, valt op tegen het bewaarde ontvangstbewijs.

### E9-S7 Publiek register: van buitenaf zien of een instantie in orde is
Als koper of verkoper wil ik op een publieke plek kunnen opzoeken of de website van deze makelaar te vertrouwen is, zodat ik dat niet aan die makelaar zelf hoef te vragen.

Dit is bewust een register en geen centrale core. Alle live biedingen op een plek zetten zou een AVG-honeypot opleveren, de beheerder aansprakelijk maken, een single point of failure creeren en een monopolie vestigen; zie ARCHITECTURE.md §6. Wat centraal mag staan is dun en bevat geen biedingen.

Het register houdt drie dingen bij:

1. **Een trust-list.** Publieke sleutel van de instantie plus een geldig, intrekbaar certificaat.
2. **De transparency-log.** Waar iedere instantie haar root-hashes naartoe anchort. Alleen hashes, geen persoonsgegevens.
3. **De gepubliceerde hashes** van gecertificeerde releases, inclusief het afgeschermde biedartefact uit E9-S5.

Daarmee kan iedereen van buitenaf, zonder iets voor die makelaar te hosten en zonder dat de beheerder meer te zien krijgt, controleren: heeft deze instantie een geldig certificaat, anchort zij daadwerkelijk, en is het biedartefact dat zij laadt een erkende versie.

Acceptatiecriteria:
- Het register is publiek te bevragen op domeinnaam en op instantiesleutel.
- Het toont per instantie: certificaatstatus, laatste anchor met tijdstip, en de versie van het biedartefact.
- Een ingetrokken certificaat is meteen zichtbaar.
- Het register bevat geen biedingen, geen persoonsgegevens en geen woninggegevens.
- Een bezoeker kan vanaf de woningpagina in een klik naar de registervermelding van die instantie.

Testcases:
- TC1: een gecertificeerde instantie is vindbaar en toont een recente anchor.
- TC2: een instantie die drie dagen niet geanchord heeft, is als zodanig zichtbaar.
- TC3 (beveiliging): een instantie die een niet-erkend biedartefact laadt, is als zodanig zichtbaar.
- TC4 (privacy): het register bevat geen enkel gegeven dat naar een bieder of woning te herleiden is.

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

Later: E1-S3, E1-S5, E4-S2, E5-S2, E6-S1, E6-S3, E8-S2, E9, E10, E11.

## Testsoorten

- Property-based tests op de invarianten in E2, E3 en E4. Dit zijn de belangrijkste.
- Integratietests op de API-contracten in E1, E2, E5, E7.
- Verificatietests met de losse verifier in E8, zodat de gebruiker echt onafhankelijk kan controleren.
- Negatieve en beveiligingstests overal waar "beveiliging" staat, want die bewijzen dat vals spelen faalt.
