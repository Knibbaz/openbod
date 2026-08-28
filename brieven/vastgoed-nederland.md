Aan: Vastgoed Nederland
Betreft: open referentie-implementatie voor verzegeld bieden, als invulling van de regulering die u bepleit
Datum: [datum]

Geachte heer, mevrouw,

Uw organisatie onderschrijft de behoefte aan wettelijke regulering van het
biedproces. Dat is minder vanzelfsprekend dan het klinkt — een brancheorganisatie
die zelf om regels vraagt, doet dat meestal omdat zelfregulering het probleem niet
oplost. Ik denk dat u gelijk hebt, en ik heb gebouwd hoe zo'n regel er technisch
uit kan zien: https://github.com/Knibbaz/openbod, met een werkende demo op DEMO_URL.

**De kern.** Het biedproces is nu zo ingericht dat de verkopende makelaar als enige
alle informatie heeft. Dat maakt hem verdacht, ook wanneer hij niets fout doet, en
dat is voor uw leden minstens zo vervelend als voor kopers. Wie beschuldigd wordt
van sturen kan zijn onschuld niet aantonen, want de gegevens waarmee dat zou
moeten, beheert hij zelf.

Dit project haalt die informatievoorsprong weg, en daarmee ook de verdenking:

- Biedingen zijn versleuteld tot de deadline, ook voor de makelaar. Niet als
  belofte, maar omdat de sleutel dan nog niet bestaat.
- Elke gebeurtenis staat in een keten die zichtbaar breekt als er achteraf iets
  wordt gewijzigd, ingevoegd of weggehaald.
- Het biedlogboek gaat automatisch naar alle betrokkenen, in plaats van op verzoek.
- De namen van bieders zijn voor de makelaar op geen enkel moment leesbaar.

Dat laatste punt is voor uw leden waarschijnlijk het meest wennen, en tegelijk
het sterkste. Een makelaar die de bedragen niet kan zien vóór de deadline, kán
niet sturen — en kan dat ook laten zien. Het verwijt dat een derde partij "vast
wel meekijkt", verdwijnt daarmee uit het gesprek.

**Waarom ik u schrijf.** Het is verleidelijk om regulering te laten neerkomen op
een verplichting waar niemand op kan controleren, en dan zijn we over drie jaar
terug bij hetzelfde klachtenbeeld. Als de eis daarentegen luidt dat het proces
achteraf door iedereen na te rekenen moet zijn, verandert er wél iets — en dan is
het prettig als er een vrij beschikbare, open invulling ligt in plaats van dat elke
aanbieder zijn eigen gecertificeerde doos verkoopt.

Ik zou u drie dingen willen vragen:

1. Of iemand met praktijkervaring een keer wil kijken en wil zeggen wat er vanuit
   het werk van een makelaar niet klopt of ontbreekt. Ik pas het aan.
2. Of dit bruikbaar is als concreet voorbeeld in uw gesprekken met het ministerie
   over hoe toetsbare regulering eruit kan zien.
3. Hoe u aankijkt tegen de verhouding tot uw eigen platform. Ik zie ze niet als
   concurrenten: dit project is geen dienst en verkoopt niets. Het is een open
   protocol met een referentie-implementatie, die iedereen mag draaien — u ook.

Voor de volledigheid: dit is een werkende referentie-implementatie, geen
productiesysteem. Wat er nog niet in zit, waaronder antiwitwascontrole en
identiteitsvaststelling op het niveau dat u in de praktijk nodig heeft, staat
expliciet in de documentatie.

Met vriendelijke groet,

[Naam]
[e-mailadres]
https://github.com/Knibbaz/openbod
