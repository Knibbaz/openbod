# Open Transparant Bieden

**Een open, verifieerbare referentie-implementatie voor een eerlijk biedproces op de woningmarkt**

Werktitel: *OpenBod* (placeholder). Kies later een naam die niet botst met bestaande protocollen zoals het NVM-protocol "Transparant Bieden" of het platform "Eerlijk Bieden" van Vastgoed Nederland.

Status: serieus hobby- en referentieproject. Open source, klein gehouden, geen commerciële SaaS. Doel is de schoonste open invulling van de NTA 8061 en een begrijpelijke demo die naar het ministerie kan.

---

## 1. Samenvatting

Het biedproces op de Nederlandse woningmarkt voelt voor veel kopers als een black box. Je weet niet hoeveel mensen er bieden, wat zij bieden, of het eerlijk verloopt, en of het biedlogboek dat je hoort te krijgen ook echt klopt. De verkopende makelaar ziet ondertussen elk bod in real time binnenkomen, wat de belangrijkste plek is waar wantrouwen ontstaat.

Dit project beschrijft een open protocol en een werkende referentie-implementatie waarin dat vertrouwen niet berust op de belofte van een partij, maar op wiskunde. Biedingen zijn verzegeld tot een gezamenlijke deadline (ook voor de makelaar), gaan daarna automatisch open, en worden vastgelegd in een logboek dat achteraf niet ongemerkt aangepast kan worden. Alles is open source en controleerbaar. De identiteitslaag is bewust een losse module, zodat een demo met simpele login later kan federeren met een zwaarder middel.

De inzet is niet een lagere prijs, maar inzicht en eerlijkheid.

## 2. Het probleem

- De koper mist inzicht. Aantal biedingen, hoogte, voorwaarden en het moment van toewijzing zijn vooraf onzichtbaar.
- De verkopende makelaar kan meekijken. Doordat biedingen bij de makelaar binnenkomen, ontstaat de mogelijkheid (en de verdenking) van sturen of lekken.
- Het biedlogboek werkt ongelijk. Het is sinds 2023 verplicht voor aangesloten makelaars, maar in de praktijk kreeg in 2025 maar ongeveer een derde van de kopers en verkopers het, vaak pas na er zelf om te vragen.
- Er concurreren standaarden. Het NVM-protocol (verplicht voor NVM-leden sinds 1 februari 2026) staat naast de bredere NTA 8061 en het platform Eerlijk Bieden. Vereniging Eigen Huis vindt de zelfregulering te mager en vraagt het ministerie om één wettelijk verplichte, gecertificeerde standaard met onafhankelijk toezicht.
- Er is een beslismoment. Het ministerie verkent regelgevingsopties en presenteert de uitkomsten deze zomer aan de Tweede Kamer.

Kortom, er is momentum, en er is behoefte aan een concrete, controleerbare invulling die laat zien hoe "aantoonbaar eerlijk" er technisch uitziet.

## 3. Het idee in het kort

Een verzegeld ("blind") biedproces met commit-reveal, waarbij:

1. Biedingen tot de deadline versleuteld zijn en voor niemand leesbaar, ook niet voor de operator of de makelaar.
2. Op de deadline alles automatisch opengaat, zonder dat bieders daarvoor iets hoeven te doen.
3. Elke gebeurtenis in een onwrikbaar logboek staat, zodat invoegen, wijzigen of verwijderen achteraf zichtbaar wordt.
4. Het volledige logboek na afronding automatisch naar alle betrokkenen gaat.
5. De hele codebasis open en verifieerbaar is, zodat iedereen kan controleren dat het systeem doet wat het belooft.

## 4. Hoe het werkt (het protocol)

### Commit-fase (verzegeld bieden)

Een bieder stuurt zijn bod versleuteld in. Het systeem bewaart een commitment (een hash) plus de versleutelde inhoud. Het bedrag en de voorwaarden zijn op dat moment voor niemand leesbaar. Zo kan de operator niet gluren en kan achteraf niemand beweren dat een bod anders luidde dan het was.

### Onthulling op de deadline (timelock)

De biedingen worden versleuteld met een timelock, gekoppeld aan een publieke randomness-beacon (zoals drand). Pas op het afgesproken moment komt de ontsleutelsleutel publiek beschikbaar, waarna iedereen de biedingen kan ontsleutelen. Voordeel: er is geen partij die de sleutel vasthoudt en dus vooraf kan meekijken, en geen bieder hoeft online te zijn om zijn eigen bod te "onthullen". De vervelende zwakte van naïef commit-reveal (een verliezer die weigert te onthullen) is hiermee weg.

### Onwrikbaar logboek (hashketen plus verankering)

Elke gebeurtenis (bod geplaatst, aangepast, ingetrokken, geopend, gesloten, onthuld) wordt een regel in een append-only logboek. Elke regel bevat de hash van de vorige, dus de keten breekt zichtbaar zodra iemand iets in het verleden verandert. Periodiek publiceer je alleen de root-hash van het logboek op een publieke plek, als onafhankelijk bewijs van integriteit. Er komen geen persoonsgegevens op die publieke plek, alleen hashes. Dat houdt het AVG-proof.

### Identiteit als losse naad

Login is een aparte backend die de biedlogica niet raakt. Die backend authenticeert de gebruiker en geeft een ondertekend token af (OIDC-stijl) met een subject-claim, dat de bied-core verifieert. In de demo is de loginmethode een magic link (verificatie van een e-mailadres, genoeg om het protocol te tonen). Later federeert hier een zwaarder middel in.

Belangrijk: DigiD is hier niet zomaar bruikbaar. Aansluiten op DigiD mag alleen als je een bij wet vastgestelde publieke taak uitvoert en BSN-gerechtigd bent, plus een jaarlijkse ICT-beveiligingsassessment doet. Een privaat biedplatform voldoet daar niet aan. Het private equivalent is iDIN (via de banken). Daarom blijft identiteit een naad: de demo toont waar een iDIN- of DigiD-waardig middel inschuift, zonder die kant nu te bouwen.

## 5. Architectuur op hoofdlijnen

Drie eenheden, met een helder contract ertussen:

| Eenheid | Verantwoordelijkheid | Ziet biedingen vóór deadline? |
|---|---|---|
| Bied-core | Commitments, timelock, hashketen-logboek, onthulling, biedlogboek genereren | Nee, niemand |
| Identiteit-backend | Authenticatie (magic link nu, iDIN later), tokens uitgeven | n.v.t. |
| Demo-frontend | Kale UI die het verhaal vertelt | n.v.t. |

De bied-core exposeert een API en bevat geen login-logica. Het krijgt alleen een geverifieerde subject-verklaring binnen. Zo is login verwisselbaar zonder de core te wijzigen.

**Hosting.** De repo is de hoofddeliverable, want vertrouwen komt uit de open code plus het protocol, niet uit waar het draait. Daarnaast host je één live demo-instantie zodat men kan klikken zonder te installeren. In productie draait later elke adopter zijn eigen instantie: veel instanties, één protocol.

### Waar vertrouwen vandaan komt

Je kunt een host niet onaanpasbaar maken, want wie iets host kan zijn eigen deployment altijd wijzigen. Vertrouwen komt daarom niet uit "de host belooft niks te veranderen", maar uit twee dingen:

1. Het protocol maakt vals spelen zinloos of zichtbaar, ongeacht de host. De timelock verhindert vroeg meekijken. De hashketen plus verankering maakt knoeien detecteerbaar. Het automatisch verstuurde logboek maakt het controleerbaar.
2. Verifieerbaarheid dat de draaiende instantie de geauditeerde code is. Dat regel je met reproduceerbare builds of build-attestatie (bijvoorbeeld Sigstore of SLSA), en op de uitlegsite door codefragmenten rechtstreeks uit de repo op een vastgezette commit te tonen, zodat wat je laat zien niet kan afwijken van de echte file.

## 6. Wat elk bod bevat (het biedformulier)

Een bod is meer dan een bedrag. Het volledige, verzegelde pakket bevat:

| Onderdeel | Toelichting |
|---|---|
| Bedrag | Het geboden bedrag voor de woning |
| Opleverdatum | Gewenste datum van overdracht |
| Geldigheidsduur | Tot wanneer het bod staat |
| Voorbehouden | Zie hieronder |
| Motivatie | Optionele vrije tekst |
| Roerende zaken ter overname | Per item, zie hieronder |
| Zekerheidssignaal | Optionele financieringsverklaring (iDIN of adviseur) |

### Voorbehouden

Voorbehouden staan expliciet in het bod en zijn bij de onthulling voor de verkoper vergelijkbaar naast elkaar. Standaard beschikbaar:

- **Financieel voorbehoud.** Het bod vervalt als de bieder de financiering niet rond krijgt, met een datum waarvoor dit geregeld moet zijn.
- **Bouwdepot-voorbehoud.** Het bod is afhankelijk van een hypotheek met een bouwdepot, bijvoorbeeld bij een woning die verbouwd of verduurzaamd moet worden.
- Uitbreidbaar met andere gangbare voorbehouden, zoals bouwkundige keuring, verkoop eigen woning of NHG.

Dat een bod voorbehouden bevat, wordt zichtbaar zonder waardeoordeel. De verkoper weegt zelf zekerheid tegen hoogte.

### Motivatie

Een bieder kan een korte motivatie toevoegen. Die zit mee in het verzegelde pakket en gaat pas bij de onthulling naar de verkoper. Let op de privacy: een motivatie bevat vaak persoonlijke informatie. Alleen de verkoper ziet die, niet de andere bieders, en in het openbare logboek wordt zij weggelaten of geanonimiseerd.

### Roerende zaken ter overname

Bij veel woningen zijn er zaken die de koper kan overnemen, van gordijnen en witgoed tot tuinmeubels of losse stoelen. Vaak wordt dit los en rommelig geregeld. In dit systeem wordt het onderdeel van het bod.

De verkoper stelt vooraf een lijst op. Per item kiest hij een status:

- Blijft achter (gaat mee met de woning)
- Ter overname voor een vast bedrag
- Ter overname in overleg
- Niet beschikbaar

De bieder geeft per item aan:

- Geen interesse
- Overnemen voor het gevraagde bedrag
- Een eigen bod van een bepaald bedrag
- In overleg

Deze keuzes zitten mee in het verzegelde bod en komen bij de onthulling boven water, en worden vastgelegd in het logboek. Zo ziet de verkoper niet alleen de prijs, maar het hele pakket per bieder. Een overname-onderdeel kan ook onder voorbehoud staan, bijvoorbeeld afhankelijk van financiering.

Voorbeeld:

| Item | Status verkoper | Keuze bieder |
|---|---|---|
| Gordijnen woonkamer | Ter overname, in overleg | Bod van 150 euro |
| Wasmachine | Ter overname, 200 euro | Overnemen voor gevraagd bedrag |
| Eetkamerstoelen (6) | Ter overname, in overleg | In overleg |
| Tuinset | Blijft achter | n.v.t. |

Extra nette bijvangst: roerende zaken horen in de koopovereenkomst apart van de woning te staan, mede omdat er geen overdrachtsbelasting over betaald wordt. Een reële, vastgelegde opgave helpt latere discussie en scheve waarderingen voorkomen.

## 7. Wat elke rol nodig heeft

### De bieder

- Een account met geverifieerde identiteit (magic link in de demo, iDIN-waardig later).
- Inzicht in de spelregels: de deadline, of het aantal biedingen zichtbaar is, of je vóór de deadline mag intrekken of aanpassen, en wie mag inzien.
- Een biedformulier: bedrag, voorbehouden, opleverdatum, geldigheidsduur, overname-keuzes en optionele motivatie.
- Optioneel een financieringsverklaring om zekerheid te tonen zonder het hele financiële plaatje prijs te geven.
- De mogelijkheid om vóór de deadline in te trekken of aan te passen als de regels dat toestaan, waarbij elke wijziging gelogd wordt.
- Na afloop het geanonimiseerde logboek, zodat hij ziet hoe het proces verliep.

### De verkoper

- Een woning aanmaken: prijsvorm (vraagprijs, richtprijs of bieden vanaf), verkoopmethode, sluitingsdatum en de lijst van zaken ter overname.
- De regels instellen: intrekken of aanpassen toegestaan, aantal biedingen zichtbaar, wie inzage krijgt.
- Op de deadline alle biedingen ontsleuteld en compleet, dus bedrag plus voorbehouden plus overname plus motivatie, naast elkaar en met zekerheidssignalen.
- Het recht van gunning: zelf kiezen aan wie hij gunt, of een nieuwe ronde starten.
- Het automatisch gegenereerde biedlogboek.

### De makelaar

- Namens de verkoper een woning klaarzetten, of de verkoper doet dit zelf.
- Kan de bedragen vóór de deadline niet zien. Dit is bewust, en het is precies de eerlijkheidswinst.
- Op de deadline de resultaten, met ondersteuning van de gunning.
- Automatische naleving van de NTA 8061 en een logboek dat vanzelf naar alle partijen gaat.
- Optioneel een WWFT-module voor antiwitwascontrole (buiten de demo-scope, een latere betaalde uitbreiding).

## 8. Voorstel voor de minister

**Context.** Het biedproces wordt als ondoorzichtig en soms oneerlijk ervaren. Het biedlogboek wordt ongelijk toegepast, er staan concurrerende protocollen naast elkaar, en Vereniging Eigen Huis vraagt om één wettelijk verplichte, gecertificeerde standaard met onafhankelijk toezicht. Het ministerie verkent opties en beslist deze zomer.

**Kern van het voorstel.** Maak één open, controleerbare standaard (de NTA 8061) verplicht voor alle partijen die woningen aan consumenten verkopen, met onafhankelijke conformiteitstoetsing. Gebruik een open referentie-implementatie als publiek ijkpunt, zodat "aantoonbaar eerlijk" niet een marketingterm is maar een technisch te controleren eigenschap.

**Wat dit project biedt.**

- Een open source, auditbare referentie-implementatie plus een begrijpelijke demo, gratis en zonder commercieel eigenbelang in een monopolie.
- Een concrete invulling waarin de operator aantoonbaar niet kan meekijken of knoeien, in plaats van een belofte.
- Een basis voor conformiteitstoetsing tegen de NTA 8061.
- Een commons-model, waarin meerdere ondernemers dezelfde open backend kunnen draaien en zo samen een geloofwaardig, transparant alternatief vormen.

**Wat we vragen.**

- Overweeg de NTA 8061 wettelijk verplicht te stellen, met onafhankelijke conformiteitstoetsing en automatische verstrekking van het logboek.
- Erken of ondersteun een open referentie-implementatie als publiek ijkpunt, eventueel via publieke of Europese financiering voor open digitale infrastructuur.

## 9. NTA 8061, conformiteit (opzet)

Onderstaande matrix is de opzet. De exacte clausules moeten tegen de werkelijke tekst van de NTA 8061 worden ingevuld.

| Eis (thema) | Hoe dit systeem eraan voldoet | Bewijs in de code |
|---|---|---|
| Traceerbaar biedlogboek | Append-only hashketen van alle gebeurtenissen | Logmodule plus verificatiescript |
| Volledigheid van vastlegging | Elk bod, elke wijziging en intrekking wordt een logregel | Datamodel van het bod en de log |
| Gelijke behandeling | Alle biedingen verzegeld tot dezelfde deadline | Timelock-module |
| Geen voortijdige inzage | Operator heeft de ontsleutelsleutel niet vóór de deadline | Timelock via publieke beacon |
| Controleerbaarheid achteraf | Automatisch verstrekt logboek plus publieke verankering van de root-hash | Disclosure-module en anchoring |
| Vermelde verkoopmethode en prijsvorm | Verplichte velden bij het aanmaken van de woning | Listing-datamodel |

## 10. Scope van de demo (MVP)

Klein en echt, geen maquette:

1. Eén woning aanmaken, met prijsvorm, deadline, regels en een lijst van zaken.
2. Inloggen via magic link.
3. Een verzegeld bod plaatsen: bedrag, voorbehouden, overname-keuzes, motivatie.
4. Aantal biedingen tonen (indien aangezet), maar geen bedragen.
5. Op de deadline automatische onthulling via de timelock.
6. Het logboek genereren, verifieerbaar maken en automatisch versturen.
7. Een pagina die de integriteit uitlegt en laat verifiëren, met codefragmenten uit de repo op een vastgezette commit.

## 11. Grenzen en wat dit niet is

- Geen SaaS en geen poging tot een monopolie. Het is een open referentie en een commons.
- Geen vervanging van DigiD. Identiteit is een naad, met iDIN als realistisch privaat middel.
- Geen prijsverlager. Het lost inzicht en eerlijkheid op, niet de schaarste die overbieden veroorzaakt.
- Geen juridisch of fiscaal advies. Licentiekeuze en rechtsvorm vragen een kort professioneel consult.

## 12. Governance, licentie en financiering

- **Governance.** Zodra meerdere partijen het draaien, is iets lichts nodig om het neutraal te houden en versplintering te voorkomen. Minimum: een heldere spec plus conformiteitstests. Maximum: een kleine stichting die de standaard beheert.
- **Licentie.** Overweeg een copyleft-licentie (AGPL of de EUPL, die goed past bij de overheids- en EU-context) zodat verbeteringen open blijven. Een permissieve licentie (Apache 2.0) vergroot juist de adoptie. Dit is een bewuste keuze met gevolgen.
- **Financiering.** Het onderhouden van open commons-infrastructuur is precies wat een fonds als NLnet (via het EU-programma Next Generation Internet) financiert. De reguliere open call heropent naar verwachting na de zomer van 2026. Kijk daarnaast naar SIDN Fonds. Zo kun je klein blijven en toch betaald krijgen voor het open deel, zonder het SaaS-pad op te moeten.

## Bronnen en context

De feitelijke context is gebaseerd op openbare bronnen, waaronder Rijksoverheid, NVM, Vastgoed Nederland, Vereniging Eigen Huis, Logius en CBS. Cijfers en data (zoals de invoerdatum van het NVM-protocol en de gemiddelde transactieprijs) veranderen, controleer ze bij gebruik richting derden.
