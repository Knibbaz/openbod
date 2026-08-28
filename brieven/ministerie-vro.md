Aan: Ministerie van Volkshuisvesting en Ruimtelijke Ordening
      t.a.v. de directie belast met het dossier transparantie biedproces koopwoningen
Betreft: open referentie-implementatie als publiek ijkpunt bij regulering van het biedproces
Datum: [datum]

Geachte heer, mevrouw,

Uw ministerie verkent opties voor regulering van het biedproces bij de verkoop van
koopwoningen. Ik lever daar graag een concrete bouwsteen voor aan: een open,
werkende referentie-implementatie van een verzegeld biedproces, vrij beschikbaar
op https://github.com/Knibbaz/openbod en zelf uit te proberen op DEMO_URL.

**Het probleem waar ik op mik.** Bij transparantieverplichtingen ligt de last van
het bewijs op de verkeerde plek. Het biedlogboek is verplicht, maar of het klopt
is voor koper en verkoper niet vast te stellen; zij kunnen alleen constateren dat
zij het niet kregen. Toezicht bestaat dan uit het wegen van klachten achteraf,
tegen een partij die als enige de gegevens heeft. Zolang dat zo is, verschuift
strengere regelgeving vooral het gesprek, niet de bewijspositie.

**Wat een open standaard hieraan verandert.** Als het biedproces zo is ingericht
dat vals spelen zinloos of zichtbaar wordt, hoeft niemand meer op zijn woord te
worden geloofd. Concreet, en werkend in de implementatie die u kunt bekijken:

- Biedingen zijn versleuteld tot de gezamenlijke deadline, ook voor de makelaar en
  de operator. De sleutel bestaat vóór dat moment niet en komt uit een publieke,
  onafhankelijke bron.
- Elke gebeurtenis staat in een keten die breekt zodra er achteraf iets wijzigt.
  Verificatie is een rekensom die iedereen kan herhalen.
- Iedere bieder krijgt een ontvangstbewijs dat hij zelf tegen het logboek kan
  nalopen.
- De identiteit van bieders is voor operator en makelaar nooit leesbaar en komt
  pas bij gunning voor de verkoper beschikbaar, wat als aparte regel wordt
  vastgelegd.

**Wat ik u wil vragen.** Niet om subsidie of een opdracht. Wel om het volgende te
overwegen bij de vormgeving van regelgeving:

1. **Formuleer de eisen zo dat ze machinaal toetsbaar zijn.** Niet "het proces
   verloopt transparant", maar eigenschappen waarvan een toetser kan vaststellen
   dat een implementatie ze heeft. De eisen die dit project hanteert staan
   uitgeschreven in `spec/protocol.md` en zijn als testbare invarianten
   geformuleerd. Ze zijn vrij te gebruiken.
2. **Erken of ondersteun een open referentie-implementatie als publiek ijkpunt.**
   Bij conformiteitstoetsing helpt het enorm als er één vrij beschikbare,
   auditbare invulling bestaat waartegen leveranciers zich kunnen meten, in plaats
   van dat elke partij haar eigen interpretatie certificeert.
3. **Houd de standaard open.** Meerdere aanbieders die hetzelfde protocol draaien
   is beter voor de markt dan één gecertificeerd platform, en het maakt de
   afhankelijkheid van de overheid kleiner in plaats van groter.

**Twee dingen die ik eerlijk moet melden.** Dit is een referentie-implementatie en
geen productiesysteem; wat er nog niet in zit, staat in de documentatie. En
identiteitsvaststelling is bewust buiten de kern gehouden: DigiD is voor een
privaat biedplatform niet beschikbaar, iDIN is het realistische equivalent, en het
project laat zien waar zo'n middel inschuift zonder die kant te bouwen.

Ik licht dit graag toe, en stel de uitkomsten hoe dan ook vrij beschikbaar. Het
project is open source en ik heb geen belang bij een monopolie — het tegendeel:
het is pas geslaagd als meerdere partijen het draaien.

Met vriendelijke groet,

[Naam]
[e-mailadres]
https://github.com/Knibbaz/openbod
