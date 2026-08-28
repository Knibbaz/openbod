# Over AI-geschreven code en vertrouwen

Een terechte vraag: als deze software met hulp van AI geschreven is, kun je haar dan vertrouwen? Het korte antwoord is dat vertrouwen in dit systeem nooit berust op wie de code schreef, maar op of de code open, getest en onafhankelijk te controleren is. Dat geldt of een mens of een model een regel typte.

## Vertrouwen komt uit verifieerbaarheid, niet uit auteurschap

Bij veel software vraag je: wie heeft dit gebouwd, en kan ik die partij vertrouwen? Bij OpenBod is dat bewust niet de vraag. De garanties zitten in het protocol en zijn te controleren door iedereen:

- De volledige code is open source en te lezen.
- Builds zijn reproduceerbaar, zodat iedereen kan narekenen dat de draaiende versie uit de gepubliceerde bron komt.
- Een conformance-suite toetst elke instantie tegen de eisen.
- De cryptografie zorgt dat een biedproces wiskundig klopt of aantoonbaar niet klopt. Een verzegeld bod is vóór de deadline niet leesbaar, het logboek breekt zichtbaar bij wijziging, en elke bieder kan met zijn eigen ontvangstbewijs zelf verifieren.

Zolang die controles slagen, doet het er niet toe of een regel door een mens of met AI-hulp is geschreven. Een fout maakt zichzelf zichtbaar in de tests en in de verificatie, niet in het cv van de auteur.

## Iedereen is medeverantwoordelijk

Juist omdat alles te controleren is, ligt de verantwoordelijkheid niet bij één persoon. Ze is gedeeld:

- De ontwikkelaar levert open, geteste code en is transparant over hoe die tot stand kwam.
- De operator die een instantie draait, toont een geldig certificaat en anchort in de gedeelde publieke log.
- De onafhankelijke toetser controleert de code tegen de conformance-suite.
- De bieder houdt een ontvangstbewijs in handen en kan zijn eigen bod natrekken.
- Het publiek kan het logboek en de builds verifieren.

Er is dus geen enkele partij die je op haar woord moet geloven. Dat is de kern.

## De waarborgen bij AI-hulp

AI-hulp is geen vrijbrief. Voor de vertrouwensgevoelige kern gelden strengere regels:

- Elke regel in de core wordt door een mens begrepen en geaudit, niet afgevinkt.
- Er wordt geen crypto zelf verzonnen. Het systeem knoopt beproefde bouwstenen aan elkaar, zoals een gevestigde timelock, hash- en handtekening-bibliotheken en een standaard identiteitsprotocol.
- De core wordt vóór echt gebruik onafhankelijk gereviewd door iemand met beveiligingservaring.
- Alle wijzigingen aan de core moeten de property-tests en de conformance-suite halen voordat ze meetellen.

## Openheid maakt het sterker, niet zwakker

Wij zijn open over het feit dat AI heeft meegeschreven. Dat is met opzet. "Vertrouw ons, een mens schreef het" is een zwakkere belofte dan "hier is de open code, de reproduceerbare build, de conformance-tests en de externe audit, controleer het zelf." Verzwijgen zou het vertrouwen juist ondermijnen. Transparantie over het proces hoort bij een systeem dat transparantie tot norm wil maken.

## Slot

De vraag "is dit door AI gemaakt" is bij dit project minder belangrijk dan "kan ik het zelf controleren". Het antwoord op die tweede vraag is ja, op elk niveau. Daarom is AI-hulp hier verantwoord, mits de audit, de beproefde bouwstenen en de onafhankelijke review op hun plek staan.
