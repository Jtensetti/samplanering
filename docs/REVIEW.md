# Kritisk granskning

## Etapp 1

**Kontrollerat:** ett riktigt API med SQLite, inloggade användare, skilda team och roller. Integrationstestet verifierar att en utomstående inte kan läsa/ändra ett team, att läsare inte kan skriva, att inbjudningar bara går att använda en gång och att gamla blockversioner ger konflikt utan att skriva över senaste text. Databasen öppnas igen för att verifiera lagring.

**Fynd och rättningar:**
- Introduktionens felmeddelanden hamnade först utanför vyn. Notiser är nu gemensamma även före teamskapandet.
- Hjälptext ingick i fältens tillgängliga namn. Etikett och beskrivning är nu separata och kopplade med id/aria-describedby.
- Stängning kunde dölja ett osparat utkast. Dialogen frågar nu vid osparade ändringar.
- Oväntade serverfel kunde läcka intern feltext. De ger nu ett generiskt fel och loggas på servern.

**Webbläsarkontroll:** registrering → team → plan → kort → textblock → omladdning → återöppning samt mobilnavigation fungerar. Skärmbilder av tavla och öppet dokument har granskats. Ett problem med inmatning isolerades till testwebbläsarens typsnittsmiljö, inte produkten.

**Begränsning:** samarbete sker per block med versionskontroll. Två personer kan arbeta i olika block. Samtidig redigering av exakt samma block kräver ett uttryckligt konfliktval; detta är inte teckenvis Google Docs-samskrivning. Konton använder lösenord; e-postadressen är inte verifierad och ingen e-posttjänst kopplas in.

## Etapp 2

**Kontrollerat:** mall för systeminförande skapar kolumner, typade fält och dokumentstruktur. Ett fältsvar skrivs genom gränssnittet, återfinns genom sökning och bevaras i API:t. Samma daterade uppgift syns i kalender och tidslinje. Ett separat test med två oberoende webbläsarsessioner verifierar att ett osparat utkast bevaras när en kollega skriver samma block; användaren kan därefter välja senaste versionen.

**Fynd och rättningar:**
- Att ta bort fält skulle också kunna förstöra tidigare svar. Anpassningen använder nu Dölj/Visa och bevarar data.
- Sparade filter kunde följa med till fel plan. Planvyn får nu en egen komponentidentitet per plan.
- Historiken visade först teknisk JSON. Den visar nu begripligt innehåll och stödjer återställning också till första versionen.
- Teambyte kunde lämna huvudytan på en plan som tillhörde det förra teamet. Teambyte återgår nu till planöversikten.

**Kvarvarande gräns:** tidslinjen är en Gantt-vy över uppgifternas start/slutdatum. Datum redigeras i kortet; den flyttar inte automatiskt efterföljande uppgifters datum. En publicerad anonym enkät är inte en del av denna version; formulären fylls i av teamets inloggade medlemmar.
