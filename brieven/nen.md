Aan: NEN, t.a.v. de normcommissie verantwoordelijk voor de NTA 8061
Betreft: open referentie-implementatie en machinaal toetsbare invarianten bij de NTA 8061
Datum: [datum]

Geachte heer, mevrouw,

De NTA 8061 beschrijft eisen aan het biedproces bij de verkoop van woningen. Ik heb
een open referentie-implementatie gebouwd die die eisen technisch invult, en zou
die graag als bijdrage aan de commissie aanbieden:
https://github.com/Knibbaz/openbod, met een werkende demo op DEMO_URL.

**Wat ik denk toe te kunnen voegen.** Een NTA beschrijft wat er moet gelden. De
stap die daarna vaak lastig is, is vaststellen of een implementatie eraan voldoet.
"Traceerbaar", "volledig" en "gelijke behandeling" zijn helder als eis, maar de
toetsing ervan valt in de praktijk snel terug op documentatie en verklaringen van
de leverancier.

Dit project formuleert die eigenschappen als invarianten die machinaal getest
worden. Zij staan in `spec/protocol.md`, en er hoort een testsuite bij die ze
tegen de echte implementatie draait — niet tegen een mock. Bijvoorbeeld:

| Eigenschap | Als invariant | Hoe getoetst |
|---|---|---|
| Geen voortijdige inzage | De ontsleutelsleutel bestaat niet vóór de deadline | Test tegen het echte publieke randomness-netwerk: ontsleutelen vóór de deadline faalt, erna slaagt het zonder actie van de bieder |
| Traceerbaar logboek | Append-only keten, elke regel bevat de hash van de vorige | Manipulatie van elke regel wordt gedetecteerd, met aanwijzing van de eerste kapotte plek |
| Bindende commitment | Een onthuld bod moet bij zijn commitment horen | Een gemanipuleerde inzending wordt ongeldig gemarkeerd en gelogd, niet stil weggelaten |
| Volledigheid | Elke geaccepteerde handeling levert precies één logregel op | Ook onder gelijktijdige verwerking; hierop is een echte fout gevonden en verholpen |
| Verifieerbaar ontvangstbewijs | De bieder kan zelf aantonen dat zijn bod meetelde | Losse verificatietool, buiten het systeem dat het logboek maakte |

Die laatste kolom is het punt: een toetser hoeft niet te beoordelen of een
leverancier zich netjes gedraagt, maar kan een uitkomst narekenen.

**Wat ik zou willen vragen.**

1. Of de commissie het nuttig vindt dat deze invarianten expliciet naast de
   clausules van de NTA 8061 worden gelegd, zodat per eis zichtbaar wordt hoe zij
   toetsbaar te maken is. Ik doe dat werk graag, maar heb daarvoor de normtekst
   nodig; die is niet vrij beschikbaar.
2. Of een open referentie-implementatie een rol kan spelen bij
   conformiteitsbeoordeling, als vrij beschikbaar ijkpunt waartegen leveranciers
   zich kunnen meten.

Ik heb hierbij geen commercieel belang. Het project is open source, ik verkoop geen
platform en ben geen partij in deze markt. Mijn belang is dat "aantoonbaar eerlijk"
een controleerbare eigenschap wordt in plaats van een marketingterm.

Voor de duidelijkheid: dit is een werkende referentie-implementatie, geen
gecertificeerd product. Wat er nog niet in zit, staat expliciet in de
documentatie, inclusief de plekken waar een garantie procedureel is in plaats van
wiskundig.

Met vriendelijke groet,

[Naam]
[e-mailadres]
https://github.com/Knibbaz/openbod
