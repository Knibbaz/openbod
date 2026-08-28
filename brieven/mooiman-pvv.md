Aan: de heer J. Mooiman, lid van de Tweede Kamer der Staten-Generaal
Betreft: werkende referentie-implementatie voor een eerlijk biedproces, als bouwsteen voor uw initiatiefwet
Datum: [datum]

Geachte heer Mooiman,

U werkt aan een initiatiefwet over het biedproces op de woningmarkt. Ik heb, als
onafhankelijk ontwikkelaar en zonder commercieel belang, een werkende
referentie-implementatie gebouwd die laat zien wat een wet op dit punt technisch
kan eisen. De volledige broncode staat open op https://github.com/Knibbaz/openbod en
u kunt hem zelf uitproberen op DEMO_URL.

Waarom dit u kan helpen: het lastigste aan wetgeving over transparantie is dat
"eerlijk" en "controleerbaar" moeilijk te toetsen begrippen zijn. Een makelaar die
zegt dat hij zich aan de regels houdt, is achteraf moeilijk te weerleggen. De
meldingen bij het meldpunt van Vereniging Eigen Huis gaan dan ook vooral over
dingen die pas achteraf zouden moeten blijken: biedingen die na de deadline zijn
ingevoerd, gesloten procedures waarin buitenom is verkocht.

Dit project draait die volgorde om. Het maakt die handelingen vooraf onmogelijk of
achteraf zichtbaar, en dat is te controleren zonder iemand op zijn woord te
geloven:

- **Biedingen zijn verzegeld tot de deadline, ook voor de makelaar en voor de
  beheerder van het systeem.** De ontsleutelsleutel bestaat vóór dat moment
  niemand ter beschikking; hij komt uit een publieke, onafhankelijke bron en wordt
  pas op het afgesproken tijdstip vrijgegeven. Vroeg meekijken is dus geen
  verboden handeling maar een onmogelijke.
- **Een bod dat na de deadline wordt ingevoerd, kan niet ongemerkt worden
  teruggedateerd.** Elke gebeurtenis staat in een keten waarin elke regel de
  vingerafdruk van de vorige bevat. Wie er één wijzigt, invoegt of weghaalt,
  breekt die keten op een zichtbare plek.
- **De bieder krijgt een ontvangstbewijs** waarmee hij later zelf kan aantonen dat
  zijn bod meetelde, ook als de partij die het systeem draait dat zou ontkennen.
- **De naam van de bieder is voor de makelaar op geen enkel moment leesbaar.**
  Hij is versleuteld naar de verkoper en komt pas beschikbaar bij gunning. Alleen
  bedragen verzegelen is namelijk niet genoeg: wie ziet wíe er biedt, kan nog
  steeds sturen.

Voor een wetstekst is vooral dit bruikbaar: deze eigenschappen zijn geformuleerd
als toetsbare eisen, niet als intenties. Een toezichthouder hoeft niet te
beoordelen of iemand zich netjes gedragen heeft, maar kan een logboek narekenen —
een handeling die een computer in een seconde doet en die iedereen kan herhalen.
De uitgeschreven eisen staan in `spec/protocol.md` in de repository.

Ik ben graag bereid om dit in een gesprek van een uur te laten zien en om mee te
denken over de formulering van toetsbare eisen. Ik heb daar geen commercieel
belang bij: het project is open source en bedoeld als publiek ijkpunt, niet als
product. Als het nuttiger is dat een ander het bouwt, is dat wat mij betreft prima
— zolang de eis maar controleerbaar is.

Eén ding wil ik eerlijk vooropstellen, omdat u er anders zelf tegenaan loopt: dit
is een werkende referentie-implementatie, geen productiesysteem. Wat er nog niet
in zit, staat expliciet in de documentatie, inclusief de plekken waar een garantie
procedureel is in plaats van wiskundig. Dat vind ik geen zwakte om te verbergen
maar precies wat je van een ijkpunt mag verwachten.

Met vriendelijke groet,

[Naam]
[e-mailadres]
https://github.com/Knibbaz/openbod
